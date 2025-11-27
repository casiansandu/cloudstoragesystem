# Next Steps After TypeScript Migration

## 1. Install Dependencies

Run this command to install all TypeScript dependencies and type definitions:

```cmd
npm install
```

This will install:
- TypeScript compiler
- All @types packages (Express, Node, bcrypt, etc.)
- ts-node-dev for development
- All production dependencies

## 2. Verify Installation

Check that TypeScript is installed:
```cmd
npx tsc --version
```

## 3. Test Compilation

Compile the TypeScript code:
```cmd
npm run build
```

This should create a `dist/` folder with compiled JavaScript files.

## 4. Run Development Server

Start the development server with hot reload:
```cmd
npm run dev
```

## 5. Environment Setup

Make sure your `.env` file exists with all required variables:
```
PORT=3000
JWT_SECRET=your_jwt_secret_here
DB_NAME=your_database_name
DB_USERNAME=your_database_username
DB_PASSWORD=your_database_password
FILESYSTEM_ROOT=C:/path/to/FileSpace
```

## 6. Database Setup

Ensure your PostgreSQL database has the required tables:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  username VARCHAR(255) PRIMARY KEY REFERENCES users(username),
  token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 7. Clean Up Old Files (Optional)

Once you've verified everything works, you can delete the old `.js` files:

```cmd
del /S *.js
```

**Warning**: Keep these .js files:
- Files in `node_modules/`
- Any compiled files in `dist/` after build

Or manually delete only these old source files:
- `app.js`
- `config/config.js`
- `db/db.js`
- `utils/password.js`
- All `.js` files in `controllers/`
- All `.js` files in `services/`
- All `.js` files in `middleware/`
- All `.js` files in `routes/`

## 8. Verify Type Safety

Open any TypeScript file in VSCode and verify:
- ✅ No red squiggly lines (except missing @types packages)
- ✅ Hover over variables to see their types
- ✅ Autocomplete works for all imports
- ✅ No `any` types appear when hovering

## 9. Common Issues & Solutions

### Issue: "Cannot find module 'express'"
**Solution**: Run `npm install`

### Issue: TypeScript compilation errors
**Solution**: Check that all `.env` variables are set

### Issue: "Token expired" or authentication errors
**Solution**: Clear browser cookies and session data

### Issue: Database connection errors
**Solution**: Verify PostgreSQL is running and credentials in `.env` are correct

## 10. Testing the API

Test the endpoints:

### Register
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username":"testuser","password":"password123"}'
```

### Create Directory (authenticated)
```bash
curl -X POST http://localhost:3000/dirs/create \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"folderPath":"myfolder"}'
```

### Logout
```bash
curl -X POST http://localhost:3000/auth/logout \
  -b cookies.txt
```

## 11. Production Deployment

For production:
1. Build: `npm run build`
2. Set `NODE_ENV=production` in your environment
3. Run: `npm start` (runs compiled code from `dist/`)
4. Consider using PM2 or similar for process management

## 12. IDE Setup (VSCode)

Recommended extensions:
- **ESLint**: For linting
- **Prettier**: For code formatting
- **TypeScript Hero**: For organizing imports
- **Error Lens**: For inline error display

## Success Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] Development server runs (`npm run dev`)
- [ ] All environment variables set in `.env`
- [ ] Database tables created
- [ ] Can register a new user
- [ ] Can login successfully
- [ ] Can create directories
- [ ] Can logout
- [ ] No TypeScript errors in editor

## Need Help?

- Check `MIGRATION_README.md` for architecture overview
- Check `UTILITY_TYPES_GUIDE.md` for TypeScript patterns used
- Review TypeScript errors in VSCode Problems panel
- Check server logs for runtime errors
