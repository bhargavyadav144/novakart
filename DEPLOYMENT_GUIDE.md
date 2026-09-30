# 🌐 Master Production Deployment Guide for NovaKart Platform (7 Portals + Backend)

This guide provides step-by-step instructions for:
1. **Pushing & Syncing code to GitHub Repository**: `https://github.com/bhargavyadav144/novakart`
2. **Deploying the Backend Node.js Server & Socket.IO API** to Render / Railway / AWS.
3. **Deploying All 7 Frontends** to Vercel or Netlify with independent live URLs.

---

## 🐙 Step 1: Push All Local Files to GitHub

Run the included automated PowerShell script or execute the commands manually:

### Option A: Run Automated Script (PowerShell)
```powershell
.\push_to_github.ps1
```

### Option B: Manual Command Line
```bash
cd c:\Users\USER\Desktop\smartcart

# 1. Initialize Git (if not done yet)
git init

# 2. Add remote repository URL
git remote add origin https://github.com/bhargavyadav144/novakart.git

# 3. Stage all project files
git add .

# 4. Commit changes
git commit -m "NovaKart Production Codebase: 7 Portals, Leaflet Map Route Navigation, Treasury Audits"

# 5. Push to GitHub main branch
git branch -M main
git push -u origin main --force
```

---

## ⚡ Step 2: Deploy Backend Node.js API (Render.com / Railway.app)

The backend handles database operations, authentication, Socket.IO webhooks, and payments.

1. Go to [Render.com](https://render.com) and create a free account.
2. Click **New +** ➔ **Web Service**.
3. Connect your GitHub repository: `bhargavyadav144/novakart`.
4. Configure the Web Service:
   - **Name**: `novakart-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add **Environment Variables**:
   - `PORT` = `5050`
   - `MONGO_URI` = `mongodb+srv://<username>:<password>@cluster.mongodb.net/smartcart?retryWrites=true&w=majority`
   - `JWT_SECRET` = `your_super_secret_jwt_key_2026`
   - `NODE_ENV` = `production`
6. Click **Create Web Service**. Your live backend URL will be generated:
   `https://novakart-backend.onrender.com` (or your custom domain `https://api.novakart.com`).

---

## 🌐 Step 3: Deploy All 7 Frontends (Vercel / Netlify)

Yes! Each of your 7 platforms will be deployed as an independent Web App with its own unique URL, connecting to the central live backend API!

### 1️⃣ Customer Storefront Portal
- **Folder**: `customer-frontend` (or root)
- **Vercel Settings**:
  - **Framework**: Vite
  - **Root Directory**: `./` or `customer-frontend`
  - **Build Command**: `npm run build`
  - **Output Directory**: `dist`
  - **Environment Variables**: `VITE_API_BASE_URL` = `https://novakart-backend.onrender.com`
- **Live URL**: `https://novakart.com` (or `https://novakart-shop.vercel.app`)

---

### 2️⃣ Seller Merchant Hub
- **Folder**: `seller-frontend`
- **Vercel Settings**:
  - **Framework**: Vite
  - **Root Directory**: `seller-frontend`
  - **Build Command**: `npm run build`
  - **Output Directory**: `dist`
  - **Environment Variables**: `VITE_API_BASE_URL` = `https://novakart-backend.onrender.com`
- **Live URL**: `https://seller.novakart.com` (or `https://novakart-seller.vercel.app`)

---

### 3️⃣ Delivery Rider Fleet Portal
- **Folder**: `delivery-frontend`
- **Vercel Settings**:
  - **Framework**: Vite
  - **Root Directory**: `delivery-frontend`
  - **Build Command**: `npm run build`
  - **Output Directory**: `dist`
  - **Environment Variables**: `VITE_API_BASE_URL` = `https://novakart-backend.onrender.com`
- **Live URL**: `https://rider.novakart.com` (or `https://novakart-rider.vercel.app`)

---

### 4️⃣ Admin Central Command
- **Folder**: `admin-frontend`
- **Vercel Settings**:
  - **Framework**: Vite
  - **Root Directory**: `admin-frontend`
  - **Build Command**: `npm run build`
  - **Output Directory**: `dist`
  - **Environment Variables**: `VITE_API_BASE_URL` = `https://novakart-backend.onrender.com`
- **Live URL**: `https://admin.novakart.com` (or `https://novakart-admin.vercel.app`)

---

### 5️⃣ Warehouse Logistics Hub
- **Folder**: `warehouse-frontend`
- **Vercel Settings**:
  - **Framework**: Vite
  - **Root Directory**: `warehouse-frontend`
  - **Build Command**: `npm run build`
  - **Output Directory**: `dist`
  - **Environment Variables**: `VITE_API_BASE_URL` = `https://novakart-backend.onrender.com`
- **Live URL**: `https://warehouse.novakart.com` (or `https://novakart-warehouse.vercel.app`)

---

### 6️⃣ Digital Payments & Treasury Command
- **Folder**: `payments-frontend`
- **Vercel Settings**:
  - **Framework**: Vite
  - **Root Directory**: `payments-frontend`
  - **Build Command**: `npm run build`
  - **Output Directory**: `dist`
  - **Environment Variables**: `VITE_API_BASE_URL` = `https://novakart-backend.onrender.com`
- **Live URL**: `https://treasury.novakart.com` (or `https://novakart-treasury.vercel.app`)

---

### 7️⃣ Telephony & Customer Support Desk
- **Folder**: `support-frontend` (or `customer-frontend/src/pages/SupportPage.jsx`)
- **Vercel Settings**:
  - **Framework**: Vite
  - **Root Directory**: `support-frontend`
  - **Build Command**: `npm run build`
  - **Output Directory**: `dist`
  - **Environment Variables**: `VITE_API_BASE_URL` = `https://novakart-backend.onrender.com`
- **Live URL**: `https://support.novakart.com` (or `https://novakart-support.vercel.app`)

---

## 🔄 Automatic Continuous Deployment (CI/CD)

Whenever you push code updates to your GitHub repository (`https://github.com/bhargavyadav144/novakart`), Render and Vercel will automatically re-build and publish your live apps within seconds!
