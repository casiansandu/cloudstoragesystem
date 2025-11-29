import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PORT } from './config/config';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';

const app: Application = express();

app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use('/users', userRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
