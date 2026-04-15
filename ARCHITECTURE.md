# Architecture and Flow Documentation: Local Retail Discovery Platform

## 1. Overview
The Local Retail Discovery Platform is a full-stack web application designed to connect customers with local retailers, suppliers, manufacturers, and brands. It features a discovery-based feed, geographical store mapping, real-time chat, notifications, and an inventory/post management system for businesses.

## 2. Tech Stack
- **Frontend**: React 19, Vite, React Router DOM, Tailwind CSS V4, Framer Motion (Animations), Socket.io-client.
- **Backend**: Node.js, Express.js, Socket.io (Real-time events).
- **Database / ORM**: SQLite (via Prisma ORM). Note: Designed to easily migrate to PostgreSQL for production.
- **Authentication**: JWT (JSON Web Tokens), Google OAuth integration, bcrypt for password hashing.
- **File Handling**: Multer for local uploads, `xlsx` for bulk product imports.
- **Mapping**: `@react-google-maps/api` for geographic features.

## 3. Core Data Models
The application relies on several interconnected entities defined in `schema.prisma`:
- **User**: Core entity handling authentication, roles, and profiles.
- **Store**: Owned by Users. Stores contain products, posts, team members, and have a geographic location.
- **TeamMember**: Secondary access accounts for a store, with specific permissions.
- **Product**: Inventory items belonging to a store. Can be uploaded manually or via Excel.
- **Post**: Social/Promotional entries by stores, can link directly to a product. Appears in the home feed.
- **Message**: Real-time direct messages between users/stores.
- **Follow / Like / SavedItem**: User interactions with stores and posts.
- **Review**: Ratings and feedback for stores or specific products.
- **Notification**: Real-time alerts for activities like new posts or messages.

## 4. User Roles and Access Control (RBAC)
The application implements strict role-based access control with the following roles:
- **Customer**: Can browse, search, follow stores, save posts, like, and chat with retailers.
- **Retailer**: Can create/manage a store, post updates, manage products, view analytics, and chat with customers or suppliers.
- **Supplier / Manufacturer / Brand**: B2B roles that can also manage profiles and products, mainly interacting with retailers.
- **Admin**: Full platform access for moderation and oversight.

## 5. Main User Flows

### 5.1 Authentication Flow
1. Users land on `Signup.tsx` or `Login.tsx`.
2. They can authenticate via standard Email/Phone & Password or Google Single Sign-On.
3. Upon success, a JWT is returned and stored in local state/storage.
4. *Team Member Flow*: Team members can log in using their specific credentials. The system maps them to their respective store but flags them as a team member rather than the owner.

### 5.2 Customer Discovery Flow
1. **Home Feed (`Home.tsx`)**: Displays an infinite-scroll feed of Posts. Customers can filter by "All" or "Following", and sort by geographical proximity.
2. **Search (`Search.tsx`)**: Global search for products and stores. Results are filtered out based on the user's role (e.g., restricting B2B results from general customers).
3. **Map view (`Map.tsx`)**: An interactive Google Maps interface showing nearby stores. Users can save locations and explore physically close retailers.
4. **Interaction**: Customers can 'Like' or 'Save' posts, and 'Follow' stores to curate their feed.

### 5.3 Retailer/Business Flow
1. **Store Creation/Management (`StoreProfile.tsx` & `UserSettings.tsx`)**: After signup, retailers create their store profile with a cover photo, address, and operating hours (including a 24-hour toggle).
2. **Dashboard (`RetailerDashboard.tsx`)**: Central hub for managing the business.
3. **Inventory Management**: Retailers can add products individually or bulk-upload an Excel sheet.
4. **Content Creation**: Retailers create Posts (with optional product tags and prices) to push to their followers' feeds. This triggers real-time WebSocket notifications to all followers.

### 5.4 Communication & Real-Time Flow
1. **Chat (`Messages.tsx` & `Chat.tsx`)**: Direct messaging between customers and businesses. Uses Socket.io for immediate delivery.
2. **Notifications**: Whenever a followed store makes a new Post, the backend emits a `newNotification` event via Socket.io. The `NotificationProvider` on the frontend catches this and updates the notification bell in the UI instantaneously.

## 6. Directory Structure
* **`/src`**: Frontend React application.
  * `/pages`: Core views like `Home`, `Profile`, `Map`, `Search`, etc.
  * `/components`: Reusable UI components.
  * `/context`: React Context providers for global state (e.g., Auth, Notifications).
* **`/prisma`**: Database schemas and seed scripts.
* **`/server.ts`**: The main Express backend application, handling all API routes, authentication, file uploads, and Socket.io.
* **`/uploads`**: Local directory for storing user-uploaded media (images).

## 7. Key Backend Endpoints
- `POST /api/users` & `POST /api/login`: Authentication.
- `GET /api/posts`: Feed retrieval, handling complex geographical distance sorting using the Haversine formula directly in the endpoint.
- `GET /api/search`: Role-aware hybrid search querying against Products and Stores.
- `POST /api/products/upload`: Parses `.xlsx` files using `xlsx` library and bulk inserts products.
- `POST /api/posts`: Creates posts and pushes socket notifications to followers.
