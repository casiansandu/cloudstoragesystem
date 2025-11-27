  import express, { Application } from 'express';
  import cors from 'cors';
  import cookieParser from 'cookie-parser';
  import { PORT } from './config/config.js';
  import authRoutes from './routes/auth.js';
  import userRoutes from './routes/user.js';
  import dirsRoutes from './routes/dirs.js';

  const app: Application = express();

  app.use(express.json());
  app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
  }));
  app.use(cookieParser());

  app.use('/auth', authRoutes);
  app.use('/users', userRoutes);
  app.use('/dirs', dirsRoutes);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  export default app;
