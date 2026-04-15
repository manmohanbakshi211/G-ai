import express from "express";
import { createServer as createViteServer } from "vite";
import { PrismaClient } from "@prisma/client";
import { createServer } from "http";
import { Server } from "socket.io";
import multer from "multer";
import * as xlsx from "xlsx";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this";
if (JWT_SECRET === "your-super-secret-jwt-key-change-this") {
  console.warn("WARNING: Using default JWT_SECRET. Please set JWT_SECRET in .env for production.");
}

const prisma = new PrismaClient();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// CORS - must be before everything else
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

// Setup uploads directory
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: uploadDir });

app.use("/uploads", express.static(uploadDir)); // Serve upload images

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Users
app.post("/api/users", async (req, res) => {
  try {
    const { name, phone, password, role, location } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return res.status(400).json({ error: "This phone number already exists" });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await prisma.user.create({ 
      data: { name, phone, password: hashedPassword, role, location } 
    });
    
    // Auto-login user upon creation
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    // Don't send password back to client
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: "Phone and password are required" });
    }

    // Check Team Member login first
    const teamMember = await prisma.teamMember.findUnique({ 
      where: { phone },
      include: { store: { include: { owner: true } } }
    });
    if (teamMember) {
      const validPassword = await bcrypt.compare(password, teamMember.passwordHash);
      if (!validPassword) return res.status(401).json({ error: "Invalid credentials" });

      // Generate JWT portraying as the store owner, but with a teamMemberId flag
      const token = jwt.sign({ userId: teamMember.store.ownerId, role: teamMember.store.owner.role, teamMemberId: teamMember.id }, JWT_SECRET, { expiresIn: '7d' });
      const { password: _, ...userWithoutPassword } = teamMember.store.owner;
      return res.json({ user: userWithoutPassword, token, isTeamMember: true });
    }

    // Normal User login path
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: "Your account has been blocked. Please contact support." });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    // Don't send password back to client
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/google-login", async (req, res) => {
  try {
    const { token, role } = req.body;
    
    if (!token) return res.status(400).json({ error: "No token provided" });

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!userInfoRes.ok) return res.status(401).json({ error: "Invalid Google token" });

    const userInfo = await userInfoRes.json();
    const { email, name } = userInfo;

    if (!email) return res.status(400).json({ error: "Google account has no email" });

    let user = await prisma.user.findUnique({ where: { email } });

    if (user && user.isBlocked) {
      return res.status(403).json({ error: "Your account has been blocked. Please contact support." });
    }

    if (!user) {
      const assignedRole = role || 'customer';
      const randomPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await prisma.user.create({
        data: {
          name: name || 'Google User',
          email,
          password: hashedPassword,
          role: assignedRole,
        }
      });
    }

    const jwtToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token: jwtToken });

  } catch (error) {
    console.error("Google Login Error:", error);
    res.status(500).json({ error: "Google Login failed" });
  }
});

// Chat Permissions Helper
const canChat = (roleA: string, roleB: string): boolean => {
  // Allow chat between any users
  return true;
};

// Middleware for protected routes
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Access denied" });

  jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    
    // Check if team member exists still to instantly revoke access
    if (user.teamMemberId) {
       const member = await prisma.teamMember.findUnique({ where: { id: user.teamMemberId }});
       if (!member) return res.status(403).json({ error: "Access revoked" });
    }

    (req as any).user = user;
    
    // Safety check: is user blocked? (optional: cache this to avoid DB hits on every request)
    const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { isBlocked: true } });
    if (dbUser?.isBlocked) return res.status(403).json({ error: "Account blocked" });

    next();
  });
};

app.get("/api/users/:userId/store", async (req, res) => {
  const { userId } = req.params;
  const store = await prisma.store.findFirst({
    where: { ownerId: userId },
    include: {
      _count: {
        select: { posts: true, products: true, followers: true }
      }
    }
  });
  res.json(store);
});

// User lookup (for chat headers etc.)
// --- Admin Routes ---
const requireAdmin = (req: any, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
};

// Enhanced stats
app.get("/api/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [usersCount, storesCount, postsCount, reviewsCount, reportsCount] = await Promise.all([
      prisma.user.count(),
      prisma.store.count(),
      prisma.post.count(),
      prisma.review.count(),
      prisma.report.count(),
    ]);

    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, role: true, phone: true, createdAt: true },
    });

    const recentReports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        reportedByUser: { select: { name: true } },
        reportedUser: { select: { name: true } },
        reportedStore: { select: { storeName: true } },
      },
    });

    res.json({ users: usersCount, stores: storesCount, posts: postsCount, reviews: reviewsCount, reports: reportsCount, recentUsers, recentReports });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});

// List all users
app.get("/api/admin/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { search, role, page = "1", limit = "20" } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (search) where.OR = [{ name: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }];
    if (role && role !== "all") where.role = role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, phone: true, email: true, role: true, location: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Update user (role or blocked status)
app.put("/api/admin/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, isBlocked } = req.body;
    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (isBlocked !== undefined) updateData.isBlocked = isBlocked;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, name: true, role: true, isBlocked: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Bulk update users (block/unblock)
app.post("/api/admin/users/bulk-update", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userIds, isBlocked } = req.body;
    if (!Array.isArray(userIds)) return res.status(400).json({ error: "userIds must be an array" });

    const currentUserId = (req as any).user.userId;
    
    // Filter out current user if trying to block
    const safeUserIds = (isBlocked === true) ? userIds.filter((id: string) => id !== currentUserId) : userIds;
    
    if (safeUserIds.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    await prisma.user.updateMany({
      where: { id: { in: safeUserIds } },
      data: { isBlocked: !!isBlocked }
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Bulk update error:", error);
    res.status(500).json({ error: "Failed to perform bulk update" });
  }
});

// Delete user
app.delete("/api/admin/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.$transaction([
      // Delete user's dependent records
      prisma.message.deleteMany({ where: { OR: [{ senderId: id }, { receiverId: id }] } }),
      prisma.follow.deleteMany({ where: { userId: id } }),
      prisma.review.deleteMany({ where: { userId: id } }),
      prisma.notification.deleteMany({ where: { userId: id } }),
      prisma.savedItem.deleteMany({ where: { userId: id } }),
      prisma.searchHistory.deleteMany({ where: { userId: id } }),
      prisma.savedLocation.deleteMany({ where: { userId: id } }),
      prisma.like.deleteMany({ where: { userId: id } }),
      prisma.report.deleteMany({ where: { OR: [{ reportedByUserId: id }, { reportedUserId: id }] } }),
      
      // Handle stores owned by the user
      // Note: We need to delete store dependents first. 
      // Since prisma transaction doesn't easily support nested deletes of related models 
      // without cascading in schema, we do it step by step for all stores of this user.
    ]);

    // Delete all stores and their dependents for this user
    const userStores = await prisma.store.findMany({ where: { ownerId: id } });
    for (const store of userStores) {
      // Delete likes on posts of this store first
      const storePosts = await prisma.post.findMany({ where: { storeId: store.id } });
      const postIds = storePosts.map(p => p.id);
      
      const storeProducts = await prisma.product.findMany({ where: { storeId: store.id } });
      const productIds = storeProducts.map(p => p.id);
      
      await prisma.$transaction([
        prisma.like.deleteMany({ where: { postId: { in: postIds } } }),
        prisma.post.deleteMany({ where: { storeId: store.id } }),
        prisma.review.deleteMany({ where: { OR: [{ storeId: store.id }, { productId: { in: productIds } }] } }),
        prisma.product.deleteMany({ where: { storeId: store.id } }),
        prisma.follow.deleteMany({ where: { storeId: store.id } }),
        prisma.teamMember.deleteMany({ where: { storeId: store.id } }),
        prisma.report.deleteMany({ where: { reportedStoreId: store.id } }),
        prisma.store.delete({ where: { id: store.id } }),
      ]);
    }

    // Finally delete the user
    await prisma.user.delete({ where: { id } });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Failed to delete user and its dependencies" });
  }
});

// List all stores
app.get("/api/admin/stores", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { search, page = "1", limit = "20" } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (search) where.OR = [{ storeName: { contains: search, mode: "insensitive" } }, { category: { contains: search, mode: "insensitive" } }];

    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { name: true, phone: true } },
          _count: { select: { followers: true, posts: true, products: true } },
        },
      }),
      prisma.store.count({ where }),
    ]);

    res.json({ stores, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stores" });
  }
});

// Delete store
app.delete("/api/admin/stores/:id", authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const storePosts = await prisma.post.findMany({ where: { storeId: id } });
    const postIds = storePosts.map(p => p.id);

    const storeProducts = await prisma.product.findMany({ where: { storeId: id } });
    const productIds = storeProducts.map(p => p.id);

    await prisma.$transaction([
      prisma.like.deleteMany({ where: { postId: { in: postIds } } }),
      prisma.post.deleteMany({ where: { storeId: id } }),
      prisma.review.deleteMany({ where: { OR: [{ storeId: id }, { productId: { in: productIds } }] } }),
      prisma.product.deleteMany({ where: { storeId: id } }),
      prisma.follow.deleteMany({ where: { storeId: id } }),
      prisma.teamMember.deleteMany({ where: { storeId: id } }),
      prisma.report.deleteMany({ where: { reportedStoreId: id } }),
      prisma.store.delete({ where: { id } }),
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete store error:", error);
    res.status(500).json({ error: "Failed to delete store and its dependencies" });
  }
});

// List all reports
app.get("/api/admin/reports", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = "1", limit = "20" } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
        include: {
          reportedByUser: { select: { id: true, name: true, phone: true } },
          reportedUser: { select: { id: true, name: true, phone: true } },
          reportedStore: { select: { id: true, storeName: true } },
        },
      }),
      prisma.report.count(),
    ]);

    res.json({ reports, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// Delete report
app.delete("/api/admin/reports/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await prisma.report.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete report" });
  }
});

// Admin: List all conversations on the platform
app.get("/api/admin/chats", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } },
      },
    });

    const conversationPairs = new Map();
    for (const msg of messages) {
      const ids = [msg.senderId, msg.receiverId].sort();
      const key = ids.join("_");
      if (!conversationPairs.has(key)) {
        conversationPairs.set(key, {
          id: key,
          user1: msg.senderId === ids[0] ? msg.sender : msg.receiver,
          user2: msg.senderId === ids[1] ? msg.sender : msg.receiver,
          lastMessage: msg.message,
          timestamp: msg.createdAt,
          count: 1,
        });
      } else {
        conversationPairs.get(key).count++;
      }
    }
    res.json(Array.from(conversationPairs.values()));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin chats" });
  }
});

// Admin: Get history for a conversation pair
app.get("/api/admin/chats/history", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { u1, u2 } = req.query as any;
    if (!u1 || !u2) return res.status(400).json({ error: "Both user IDs are required" });

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: u1, receiverId: u2 },
          { senderId: u2, receiverId: u1 },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
      },
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

// --- KYC Endpoints ---
// User: Submit KYC documents
app.post("/api/kyc/submit", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { documentUrl, selfieUrl, storeName, storePhoto } = req.body;

    if (!documentUrl || !selfieUrl) {
      return res.status(400).json({ error: "Both document and selfie are required" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        kycDocumentUrl: documentUrl,
        kycSelfieUrl: selfieUrl,
        kycStatus: "pending",
        kycStoreName: storeName || null,
        kycStorePhoto: storePhoto || null,
        kycSubmittedAt: new Date(),
        kycNotes: null,
      },
      select: { id: true, kycStatus: true, kycSubmittedAt: true },
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to submit KYC" });
  }
});

// User: Check KYC status
app.get("/api/kyc/status", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true, kycNotes: true, kycSubmittedAt: true, kycReviewedAt: true, kycStoreName: true, kycStorePhoto: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch KYC status" });
  }
});

// Admin: List KYC submissions
app.get("/api/admin/kyc", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { role: { not: "customer" }, kycStatus: { not: "none" } };
    if (status && status !== "all") where.kycStatus = status;

    const [users, total, pendingCount] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: [{ kycStatus: "asc" }, { kycSubmittedAt: "desc" }],
        select: {
          id: true, name: true, phone: true, role: true,
          kycStatus: true, kycDocumentUrl: true, kycSelfieUrl: true,
          kycNotes: true, kycSubmittedAt: true, kycReviewedAt: true,
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { kycStatus: "pending" } }),
    ]);

    res.json({ users, total, pendingCount, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch KYC submissions" });
  }
});

// Admin: Approve or Reject KYC
app.put("/api/admin/kyc/:userId", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body; // status: "approved" or "rejected"
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: {
        kycStatus: status,
        kycNotes: notes || null,
        kycReviewedAt: new Date(),
      },
      select: { id: true, name: true, kycStatus: true },
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update KYC status" });
  }
});

app.get("/api/users/:id", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, role: true, email: true }
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Customer: followed stores
app.get("/api/users/:id/following", authenticateToken, async (req, res) => {
  try {
    const follows = await prisma.follow.findMany({
      where: { userId: req.params.id },
      include: {
        store: {
          select: { id: true, storeName: true, category: true, address: true, averageRating: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(follows.map(f => f.store));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch followed stores" });
  }
});

// Customer: saved items
app.get("/api/users/:id/saved", authenticateToken, async (req, res) => {
  try {
    const saved = await prisma.savedItem.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: 'desc' }
    });
    // For post-type saved items, fetch associated posts
    const postIds = saved.filter(s => s.type === 'post').map(s => s.referenceId);
    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } },
      include: { store: true }
    });
    res.json({ saved, posts });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch saved items" });
  }
});

// Customer: reviews by user
app.get("/api/users/:id/reviews", authenticateToken, async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { userId: req.params.id },
      include: {
        store: { select: { id: true, storeName: true } },
        product: { select: { id: true, productName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Customer: search history
app.get("/api/users/:id/search-history", authenticateToken, async (req, res) => {
  try {
    const history = await prisma.searchHistory.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch search history" });
  }
});

// Customer: saved locations
app.get("/api/users/:id/locations", authenticateToken, async (req, res) => {
  try {
    const locations = await prisma.savedLocation.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch saved locations" });
  }
});

// Stores
app.post("/api/stores", authenticateToken, async (req, res) => {
  try {
    // KYC gate: non-customer users must be KYC approved to create a store
    const currentUser = await prisma.user.findUnique({ where: { id: (req as any).user.userId }, select: { role: true, kycStatus: true } });
    if (currentUser && currentUser.role !== "customer" && currentUser.role !== "admin" && currentUser.kycStatus !== "approved") {
      return res.status(403).json({ error: "KYC verification required", kycStatus: currentUser.kycStatus });
    }

    const { ownerId, storeName, category, description, address, phone, 
            latitude, longitude, openingTime, closingTime, workingDays, 
            gstNumber, phoneVisible, logoUrl, postalCode, is24Hours } = req.body;
    
    // Validate unique store phone (allow same as owner's signup phone)
    if (phone) {
      const actualOwnerId = ownerId || (req as any).user.userId;
      const owner = await prisma.user.findUnique({ where: { id: actualOwnerId } });
      const normalizedPhone = phone.replace(/[\s\-()\+]/g, '');
      const ownerPhone = owner?.phone?.replace(/[\s\-()\+]/g, '') || '';
      if (normalizedPhone !== ownerPhone && normalizedPhone !== ownerPhone.replace(/^91/, '')) {
        const existingStore = await prisma.store.findFirst({ where: { phone } });
        if (existingStore) {
          return res.status(400).json({ error: "This phone number is already used by another store" });
        }
      }
    }

    const store = await prisma.store.create({ 
      data: {
        ownerId: ownerId || (req as any).user.userId,
        storeName: storeName || 'My Store',
        category: category || 'General',
        description: description || '',
        address: address || '',
        phone: phone || '',
        latitude: parseFloat(latitude) || 0,
        longitude: parseFloat(longitude) || 0,
        openingTime: openingTime || null,
        closingTime: closingTime || null,
        workingDays: workingDays || null,
        gstNumber: gstNumber || null,
        phoneVisible: phoneVisible !== undefined ? phoneVisible : true,
        logoUrl: logoUrl || null,
        postalCode: postalCode ? parseInt(postalCode) : null,
        city: req.body.city || null,
        state: req.body.state || null,
        is24Hours: is24Hours || false,
      }
    });
    res.json(store);
  } catch (error) {
    console.error("Failed to create store:", error);
    res.status(500).json({ error: "Failed to create store" });
  }
});

app.put("/api/stores/:id", authenticateToken, async (req, res) => {
  try {
    const existingStore = await prisma.store.findUnique({ where: { id: req.params.id } });
    if (!existingStore) return res.status(404).json({ error: "Store not found" });

    // Validate unique store phone if phone is being updated
    if (req.body.phone && req.body.phone !== existingStore.phone) {
      const owner = await prisma.user.findUnique({ where: { id: existingStore.ownerId } });
      const normalizedPhone = req.body.phone.replace(/[\s\-()\+]/g, '');
      const ownerPhone = owner?.phone?.replace(/[\s\-()\+]/g, '') || '';
      if (normalizedPhone !== ownerPhone && normalizedPhone !== ownerPhone.replace(/^91/, '')) {
        const otherStore = await prisma.store.findFirst({ where: { phone: req.body.phone, NOT: { id: req.params.id } } });
        if (otherStore) {
          return res.status(400).json({ error: "This phone number is already used by another store" });
        }
      }
    }

    // Parse postalCode to int if provided
    const updateData = { ...req.body };
    if (updateData.postalCode !== undefined) {
      updateData.postalCode = updateData.postalCode ? parseInt(updateData.postalCode) : null;
    }

    const store = await prisma.store.update({
      where: { id: req.params.id },
      data: updateData
    });
    res.json(store);
  } catch (error) {
    console.error("Failed to update store:", error);
    res.status(500).json({ error: "Failed to update store" });
  }
});

app.get("/api/stores", async (req, res) => {
  const stores = await prisma.store.findMany();
  res.json(stores);
});

// Pincode → City/State lookup (India Post API)
app.get("/api/pincode/:code", async (req, res) => {
  try {
    const code = req.params.code;
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: "Invalid pincode" });
    const response = await fetch(`https://api.postalpincode.in/pincode/${code}`);
    const data = await response.json();
    if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      // Gather unique districts and states from all post offices
      const districts = [...new Set(data[0].PostOffice.map((p: any) => p.District))];
      const states = [...new Set(data[0].PostOffice.map((p: any) => p.State))];
      res.json({ 
        city: po.District, 
        state: po.State,
        allCities: districts,
        allStates: states,
        postOffices: data[0].PostOffice.map((p: any) => p.Name)
      });
    } else {
      res.status(404).json({ error: "Pincode not found" });
    }
  } catch (error) {
    console.error("Pincode lookup error:", error);
    res.status(500).json({ error: "Failed to look up pincode" });
  }
});

app.get("/api/stores/:id", async (req, res) => {
  const { userId } = req.query;
  const store = await prisma.store.findUnique({ 
    where: { id: req.params.id },
    include: {
      owner: { select: { role: true } },
      _count: {
        select: { posts: true, products: true, followers: true }
      },
      followers: userId ? {
        where: { userId: String(userId) }
      } : false
    }
  });
  res.json(store);
});

app.post("/api/stores/:id/follow", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const storeId = req.params.id;

    const existingFollow = await prisma.follow.findUnique({
      where: {
        userId_storeId: { userId, storeId }
      }
    });

    if (existingFollow) {
      await prisma.follow.delete({
        where: { id: existingFollow.id }
      });
      res.json({ following: false });
    } else {
      await prisma.follow.create({
        data: { userId, storeId }
      });
      res.json({ following: true });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle follow" });
  }
});

app.get("/api/stores/:id/posts", async (req, res) => {
  const posts = await prisma.post.findMany({
    where: { storeId: req.params.id },
    include: { product: true, store: { include: { owner: true } } },
    orderBy: [
      { isOpeningPost: 'desc' },
      { isPinned: 'desc' },
      { createdAt: 'desc' }
    ]
  });
  res.json(posts);
});

// Products
app.post("/api/products", authenticateToken, async (req, res) => {
  try {
    const product = await prisma.product.create({ data: req.body });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: "Failed to create product" });
  }
});

app.get("/api/products", async (req, res) => {
  const { search, category, storeId } = req.query;
  const where: any = {};
  
  if (search) {
    where.OR = [
      { productName: { contains: String(search) } },
      { description: { contains: String(search) } },
      { brand: { contains: String(search) } },
    ];
  }
  
  if (category) {
    where.category = String(category);
  }

  if (storeId) {
    where.storeId = String(storeId);
  }

  const products = await prisma.product.findMany({
    where,
    include: { store: true }
  });
  res.json(products);
});

// Mixed Search Endpoint
app.get("/api/search", authenticateToken, async (req, res) => {
  const userRole = (req as any).user.role;
  const { q } = req.query;
  if (!q) return res.json({ products: [], stores: [] });

  let allowedRoles: string[] = [];
  if (userRole === 'customer') allowedRoles = ['retailer'];
  else if (userRole === 'retailer') allowedRoles = ['retailer', 'supplier', 'manufacturer', 'brand'];
  else if (['supplier', 'manufacturer', 'brand'].includes(userRole)) allowedRoles = ['retailer'];
  else if (userRole === 'admin') allowedRoles = ['customer', 'retailer', 'supplier', 'manufacturer', 'brand', 'admin'];

  const searchStr = String(q).toLowerCase().trim();

  // Check if searching for 24-hour stores
  const is24HourSearch = searchStr.includes('24 hour') || searchStr.includes('24h') || searchStr.includes('24 hours') || searchStr === 'open 24';

  try {
    const allProducts = await prisma.product.findMany({ include: { store: { include: { owner: true } } } });
    const products = allProducts.filter(p => 
      p.store?.owner && allowedRoles.includes(p.store.owner.role) && (
        (p.productName && p.productName.toLowerCase().includes(searchStr)) ||
        (p.brand && p.brand.toLowerCase().includes(searchStr)) ||
        (p.category && p.category.toLowerCase().includes(searchStr))
      )
    ).slice(0, 20);

    const allStores = await prisma.store.findMany({ include: { owner: true } });
    
    // Helper: check if store is currently open
    const isStoreCurrentlyOpen = (s: any): boolean => {
      if (s.is24Hours) {
        // Even 24h stores respect workingDays
        if (s.workingDays) {
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const today = dayNames[new Date().getDay()];
          if (!s.workingDays.includes(today)) return false;
        }
        return true;
      }
      // Check working days first
      if (s.workingDays) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = dayNames[new Date().getDay()];
        if (!s.workingDays.includes(today)) return false;
      }
      if (!s.openingTime || !s.closingTime) return true; // assume open if no times set
      const now = new Date();
      const [oH, oM] = s.openingTime.split(':').map(Number);
      const [cH, cM] = s.closingTime.split(':').map(Number);
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const openMins = oH * 60 + oM;
      const closeMins = cH * 60 + cM;
      return closeMins > openMins ? (nowMins >= openMins && nowMins < closeMins) : (nowMins >= openMins || nowMins < closeMins);
    };

    const stores = allStores.filter(s => {
      if (!s.owner || !allowedRoles.includes(s.owner.role)) return false;
      
      // 24-hour search shortcut
      if (is24HourSearch && s.is24Hours) return true;
      
      return (
        (s.storeName && s.storeName.toLowerCase().includes(searchStr)) ||
        (s.category && s.category.toLowerCase().includes(searchStr)) ||
        (s.owner.role && s.owner.role.toLowerCase().includes(searchStr.replace(/\s+/g, ''))) ||
        (s.owner.role === 'retailer' && 'retail store'.includes(searchStr)) ||
        (s.description && s.description.toLowerCase().includes(searchStr)) ||
        (s.address && s.address.toLowerCase().includes(searchStr)) ||
        (s.postalCode && String(s.postalCode).includes(searchStr)) ||
        (s.manualProductText && s.manualProductText.toLowerCase().includes(searchStr)) ||
        ((s as any).city && (s as any).city.toLowerCase().includes(searchStr)) ||
        ((s as any).state && (s as any).state.toLowerCase().includes(searchStr))
      );
    })
    // Sort: open stores first, then closed
    .sort((a, b) => {
      const aOpen = isStoreCurrentlyOpen(a) ? 0 : 1;
      const bOpen = isStoreCurrentlyOpen(b) ? 0 : 1;
      return aOpen - bOpen;
    })
    .slice(0, 20);

    res.json({ products, stores });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Failed to perform search" });
  }
});

// Excel Upload for Products
app.post("/api/products/upload", authenticateToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const { storeId } = req.body;
    
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    const products = data.map((row: any) => ({
      storeId,
      productName: row.productName || row.name,
      brand: row.brand,
      category: row.category,
      price: parseFloat(row.price),
      description: row.description,
      tags: row.tags,
    }));
    
    await prisma.product.createMany({ data: products });
    
    // Clean up file
    fs.unlinkSync(req.file.path);
    
    res.json({ success: true, count: products.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process Excel file" });
  }
});

// Posts
app.post("/api/posts", authenticateToken, async (req, res) => {
  try {
    const { storeId, caption, imageUrl, productId, price } = req.body;
    
    // Construct Prisma create data
    const postData: any = {
      caption,
      imageUrl,
      isOpeningPost: req.body.isOpeningPost || false,
      store: { connect: { id: storeId } }
    };
    if (productId) {
      postData.product = { connect: { id: productId } };
    }
    if (price !== undefined && price !== null && price !== '') {
      postData.price = parseFloat(price);
    }

    const post = await prisma.post.create({ data: postData });
    
    // Generate Notifications for all store followers
    const storeWithFollowers = await prisma.store.findUnique({
      where: { id: post.storeId },
      include: { followers: true }
    });

    if (storeWithFollowers && storeWithFollowers.followers.length > 0) {
      const notificationData = storeWithFollowers.followers.map(follow => ({
        userId: follow.userId,
        type: 'NEW_POST',
        content: `${storeWithFollowers.storeName} just published a new post!`,
        referenceId: post.id
      }));

      // Bulk create notifications in DB
      await prisma.notification.createMany({ data: notificationData });

      // Emit to active WebSocket connections
      for (const follow of storeWithFollowers.followers) {
        // Find the newly created notification to send exact data to socket
        const newNotif = await prisma.notification.findFirst({
          where: { userId: follow.userId, referenceId: post.id, type: 'NEW_POST' },
          orderBy: { createdAt: 'desc' }
        });
        
        if (newNotif) {
          io.to(follow.userId).emit('newNotification', newNotif);
        }
      }
    }

    res.json(post);
  } catch (error) {
    console.error("Failed to create post:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

app.get("/api/posts", authenticateToken, async (req, res) => {
  const userRole = (req as any).user.role;
  const userId = (req as any).user.userId;
  const { feedType, locationRange, lat, lng } = req.query;
  
  let allowedRoles: string[] = [];
  if (userRole === 'customer') allowedRoles = ['retailer'];
  else if (userRole === 'retailer') allowedRoles = ['retailer', 'supplier', 'manufacturer', 'brand'];
  else if (['supplier', 'manufacturer', 'brand'].includes(userRole)) allowedRoles = ['retailer'];
  else if (userRole === 'admin') allowedRoles = ['customer', 'retailer', 'supplier', 'manufacturer', 'brand', 'admin'];

  let whereClause: any = {
    store: {
      owner: { role: { in: allowedRoles } }
    }
  };

  if (feedType === 'following') {
    const follows = await prisma.follow.findMany({ where: { userId } });
    whereClause.storeId = { in: follows.map(f => f.storeId) };
  }

  let posts = await prisma.post.findMany({
    where: whereClause,
    include: {
      store: { include: { owner: true } },
      product: true,
      likes: true
    },
    orderBy: [
      { createdAt: 'desc' }
    ]
  });

  if (locationRange && lat && lng && locationRange !== 'all') {
    const rangeKm = parseFloat(String(locationRange));
    const userLat = parseFloat(String(lat));
    const userLng = parseFloat(String(lng));
    
    posts = (posts as any[]).filter((post: any) => {
      const storeLat = post.store.latitude;
      const storeLng = post.store.longitude;
      const R = 6371; // km
      const dLat = (storeLat - userLat) * Math.PI / 180;
      const dLng = (storeLng - userLng) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(userLat * Math.PI / 180) * Math.cos(storeLat * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return (R * c) <= rangeKm;
    });
  }

  // Pagination
  const page = parseInt(String(req.query.page || '1'));
  const limit = parseInt(String(req.query.limit || '20'));
  const total = posts.length;
  const paginatedPosts = posts.slice((page - 1) * limit, page * limit);

  res.json({
    posts: paginatedPosts,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});

// Interactions
app.get("/api/me/interactions", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const likes = await prisma.like.findMany({ where: { userId } });
    const saves = await prisma.savedItem.findMany({ where: { userId } });
    const follows = await prisma.follow.findMany({ where: { userId } });
    
    res.json({
      likedPostIds: likes.map(l => l.postId),
      savedPostIds: saves.filter(s => s.type === 'post').map(s => s.referenceId),
      followedStoreIds: follows.map(f => f.storeId)
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch interactions" });
  }
});

// Likes
app.post("/api/posts/:id/like", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const postId = req.params.id;

    const existingLike = await prisma.like.findUnique({
      where: { userId_postId: { userId, postId } }
    });

    if (existingLike) {
      await prisma.like.delete({ where: { id: existingLike.id } });
      res.json({ liked: false });
    } else {
      await prisma.like.create({ data: { userId, postId } });
      res.json({ liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

// Saves
app.post("/api/posts/:id/save", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const postId = req.params.id;

    const existingSave = await prisma.savedItem.findUnique({
      where: { userId_type_referenceId: { userId, type: 'post', referenceId: postId } }
    });

    if (existingSave) {
      await prisma.savedItem.delete({ where: { id: existingSave.id } });
      res.json({ saved: false });
    } else {
      await prisma.savedItem.create({ data: { userId, type: 'post', referenceId: postId } });
      res.json({ saved: true });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle save" });
  }
});

// Pin Posts
app.post("/api/posts/:id/pin", authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (!post.isPinned) {
      const pinnedCount = await prisma.post.count({ where: { storeId: post.storeId, isPinned: true } });
      if (pinnedCount >= 3) return res.status(400).json({ error: "Maximum 3 pinned posts allowed" });
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { isPinned: !post.isPinned }
    });
    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle pin" });
  }
});
// Delete Single Post
app.delete("/api/posts/:id", authenticateToken, async (req, res) => {
  try {
     const post = await prisma.post.findUnique({ where: { id: req.params.id }, include: { store: true } });
     if (!post) return res.status(404).json({ error: "Not found" });
     if (post.store.ownerId !== (req as any).user.userId) return res.status(403).json({ error: "Unauthorized" });

     await prisma.like.deleteMany({ where: { postId: req.params.id } });
     await prisma.savedItem.deleteMany({ where: { type: 'post', referenceId: req.params.id } });
     await prisma.post.delete({ where: { id: req.params.id } });
     res.json({ success: true });
  } catch (error) {
     console.error("Failed to delete post:", error);
     res.status(500).json({ error: "Failed" });
  }
});

// Delete All Store Posts
app.delete("/api/stores/:storeId/posts", authenticateToken, async (req, res) => {
  try {
     const store = await prisma.store.findUnique({ where: { id: req.params.storeId } });
     if (!store || store.ownerId !== (req as any).user.userId) return res.status(403).json({ error: "Unauthorized" });

     // Fetch all post IDs to delete related records
     const posts = await prisma.post.findMany({ where: { storeId: store.id }, select: { id: true } });
     const postIds = posts.map(p => p.id);

     if (postIds.length > 0) {
       await prisma.like.deleteMany({ where: { postId: { in: postIds } } });
       await prisma.savedItem.deleteMany({ where: { type: 'post', referenceId: { in: postIds } } });
       await prisma.post.deleteMany({ where: { storeId: store.id } });
     }
     res.json({ success: true });
  } catch (error) {
     console.error("Failed to delete all store posts:", error);
     res.status(500).json({ error: "Failed" });
  }
});

// Conversations Inbox
app.get("/api/conversations", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    // Fetch all messages involving this user
    const allMessages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } },
      },
    });

    // Group by unique conversation partner
    const conversationsMap = new Map();
    
    for (const msg of allMessages) {
      const isSender = msg.senderId === userId;
      const otherUser = isSender ? msg.receiver : msg.sender;
      
      if (!conversationsMap.has(otherUser.id)) {
        // Find if this user owns a store for better display names
        let displayName = otherUser.name;
        let logoUrl = null;
        if (otherUser.role === 'retailer') {
           const store = await prisma.store.findFirst({ where: { ownerId: otherUser.id } });
           if (store) {
             displayName = store.storeName;
             logoUrl = store.logoUrl;
           }
        }

        conversationsMap.set(otherUser.id, {
          id: msg.id,
          userId: otherUser.id,
          storeName: displayName,
          logoUrl: logoUrl,
          lastMessage: msg.message,
          timestamp: msg.createdAt,
          unread: 0, // Mock unread for now
        });
      }
    }

    res.json(Array.from(conversationsMap.values()));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Messages
app.get("/api/messages/:userId/:otherUserId", authenticateToken, async (req, res) => {
  const { userId, otherUserId } = req.params;
  const authenticatedUserId = (req as any).user.userId;
  const authenticatedUserRole = (req as any).user.role;

  // Prevent reading other people's messages
  if (authenticatedUserId !== userId && authenticatedUserId !== otherUserId) {
    return res.status(403).json({ error: "Unauthorized access to these messages" });
  }

  // Enforce Chat Permissions
  const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
  if (!otherUser || !canChat(authenticatedUserRole, otherUser.role)) {
    return res.status(403).json({ error: "Role permissions do not allow chatting with this user" });
  }

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId }
      ]
    },
    orderBy: { createdAt: 'asc' }
  });
  res.json(messages);
});

// Send message via HTTP (reliable fallback)
app.post("/api/messages", authenticateToken, async (req, res) => {
  try {
    const senderId = (req as any).user.userId;
    const { receiverId, message, imageUrl } = req.body;
    if (!receiverId || (!message && !imageUrl)) return res.status(400).json({ error: "receiverId and message/imageUrl required" });

    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!sender || !receiver) return res.status(404).json({ error: "User not found" });
    if (!canChat(sender.role, receiver.role)) return res.status(403).json({ error: "Chat not permitted between these roles" });

    const savedMessage = await prisma.message.create({
      data: { senderId, receiverId, message: message || '', imageUrl: imageUrl || null }
    });

    // Emit via socket for real-time delivery
    io.to(receiverId).emit("newMessage", savedMessage);
    io.to(senderId).emit("newMessage", savedMessage);

    res.json(savedMessage);
  } catch (error) {
    console.error("Failed to send message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Reviews
app.get("/api/reviews/store/:storeId", async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { storeId: req.params.storeId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch store reviews" });
  }
});

app.get("/api/reviews/product/:productId", async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId: req.params.productId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch product reviews" });
  }
});

app.post("/api/reviews", authenticateToken, async (req, res) => {
  try {
    const { rating, comment, storeId, productId } = req.body;
    const userId = (req as any).user.userId;

    if (!storeId && !productId) return res.status(400).json({ error: "Must review either a store or a product" });
    if (storeId && productId) return res.status(400).json({ error: "Cannot review both store and product at once" });

    // Ensure the rating is valid
    const validRating = Math.max(1, Math.min(5, Math.floor(rating) || 5));

    const newReview = await prisma.review.create({
      data: { rating: validRating, comment, storeId, productId, userId }
    });

    // Recalculate Average Rating
    if (storeId) {
      const aggregates = await prisma.review.aggregate({
        where: { storeId },
        _avg: { rating: true },
        _count: { id: true }
      });
      await prisma.store.update({
        where: { id: storeId },
        data: { averageRating: aggregates._avg.rating, reviewCount: aggregates._count.id }
      });
    } else if (productId) {
      const aggregates = await prisma.review.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: { id: true }
      });
      await prisma.product.update({
        where: { id: productId },
        data: { averageRating: aggregates._avg.rating, reviewCount: aggregates._count.id }
      });
    }

    res.json(newReview);
  } catch (error) {
    console.error("Failed to post review:", error);
    res.status(500).json({ error: "Failed to save review" });
  }
});

// Notifications
app.get("/api/notifications", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to 50 most recent
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

app.post("/api/notifications/:id/read", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const notification = await prisma.notification.update({
      where: { id: req.params.id, userId }, // ensure security
      data: { isRead: true }
    });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

app.post("/api/notifications/read-all", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

// Image Uploads
app.post("/api/upload", authenticateToken, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Team Management — Full CRUD
// List team members for a store
app.get("/api/team/:storeId", authenticateToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = (req as any).user.userId;
    const teamMemberId = (req as any).user.teamMemberId;

    // Only owner can view team (not team members)
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerId !== userId || teamMemberId) {
      return res.status(403).json({ error: "Only the owner can manage the team" });
    }

    const members = await prisma.teamMember.findMany({
      where: { storeId },
      select: { id: true, phone: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch team members" });
  }
});

// Add team member
app.post("/api/team", authenticateToken, async (req, res) => {
  try {
    const { phone, password, storeId, name } = req.body;
    const userId = (req as any).user.userId;
    const teamMemberId = (req as any).user.teamMemberId;

    // Only owner can add team members
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerId !== userId || teamMemberId) {
      return res.status(403).json({ error: "Only the owner can add team members" });
    }

    // Validate inputs
    if (!phone || !password) return res.status(400).json({ error: "Phone and password are required" });
    if (password.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters" });

    // Check unique phone
    const existing = await prisma.teamMember.findUnique({ where: { phone } });
    if (existing) return res.status(400).json({ error: "A team member with this phone number already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const member = await prisma.teamMember.create({
      data: { phone, passwordHash: hashedPassword, storeId, name: name || 'Team Member', role: 'member' },
      select: { id: true, phone: true, name: true, role: true, createdAt: true }
    });
    res.json(member);
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(400).json({ error: "Phone number already in use" });
    res.status(500).json({ error: "Failed to add team member" });
  }
});

// Remove team member
app.delete("/api/team/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const teamMemberId = (req as any).user.teamMemberId;

    // Only owner can remove members (and not if they're a team member themselves)
    if (teamMemberId) return res.status(403).json({ error: "Team members cannot remove other members" });

    const member = await prisma.teamMember.findUnique({ where: { id }, include: { store: true } });
    if (!member) return res.status(404).json({ error: "Team member not found" });
    if (member.store.ownerId !== userId) return res.status(403).json({ error: "Only the owner can remove team members" });

    await prisma.teamMember.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove team member" });
  }
});

// WebSocket Chat Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return next(new Error('Authentication error: Invalid token'));
    // Attach user information to the socket for later use
    (socket as any).user = decoded;
    next();
  });
});

io.on("connection", (socket) => {
  const userId = (socket as any).user.userId;
  console.log("Authenticated user connected:", userId, "Socket:", socket.id);
  
  // Automatically join the user to a room of their own ID to receive private messages
  socket.join(userId);
  
  socket.on("sendMessage", async (data) => {
    try {
      const { receiverId, message } = data;
      const senderId = userId;
      
      const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
      const sender = await prisma.user.findUnique({ where: { id: senderId } });
      
      if (!receiver || !sender || !canChat(sender.role, receiver.role)) {
        console.error("Chat permission denied for", sender?.role, "to", receiver?.role);
        return; // Silent drop of unauthorized message
      }
      
      const savedMessage = await prisma.message.create({
        data: { senderId, receiverId, message, imageUrl: data.imageUrl || null }
      });
      
      io.to(receiverId).emit("newMessage", savedMessage);
      io.to(senderId).emit("newMessage", savedMessage); // echo back to sender

      // Auto-reply logic for retailers
      if (receiver?.role === 'retailer' && sender?.role === 'customer') {
        const previousMessages = await prisma.message.count({
          where: { senderId, receiverId }
        });

        // Trigger only on the first message from this customer to this retailer
        if (previousMessages === 1) {
          const store = await prisma.store.findFirst({ where: { ownerId: receiverId } });
          if (store) {
            const firstName = sender.name.split(' ')[0];
            const storeDetails = `${store.storeName}, ${store.address} (Ph: ${store.phone || 'N/A'})`;
            const autoReplyText = `Thanks for reaching out ${firstName}. Our team will connect shortly. \n\nStore Details: ${storeDetails}`;
            
            setTimeout(async () => {
              try {
                const autoReply = await prisma.message.create({
                  data: { senderId: receiverId, receiverId: senderId, message: autoReplyText }
                });
                io.to(senderId).emit("newMessage", autoReply);
                io.to(receiverId).emit("newMessage", autoReply);
              } catch (e) {
                console.error("Auto-reply failed:", e);
              }
            }, 1000);
          }
        }
      }
    } catch (error) {
      console.error("Failed to save message:", error);
    }
  });
  
  socket.on("disconnect", () => {
    console.log("User disconnected:", userId, "Socket:", socket.id);
  });
});

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
