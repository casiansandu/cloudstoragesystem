import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PORT } from './config/config';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import fileRoutes from './routes/file';
import https from 'https';
import fs from 'fs';
import path from 'path';

const certPath = path.join(__dirname, 'certs', 'localhost.pem');
const keyPath = path.join(__dirname, 'certs', 'localhost-key.pem');
const httpsOptions = {
  cert: fs.readFileSync(certPath),
  key: fs.readFileSync(keyPath),
  minVersion: 'TLSv1.3' as const 
};
const app: Application = express();

app.use(express.json());
app.use(cors({
  origin: 'https://localhost:5173',
  credentials: true
}));
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/files', fileRoutes);

https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
