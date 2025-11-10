

const { PORT } = require('./config/config')
const fileUpload = require("express-fileupload");

const express = require('express')
const app = express()

app.use(express.json());
//app.use(fileUpload());

const authRoutes = require('./routes/auth')
//const userRoutes = require('./routes/user')
const dirsRoutes = require('./routes/dirs')

app.use("/auth", authRoutes);
//app.use("/users", userRoutes);
app.use("/dirs", dirsRoutes)
//app.use("upload")


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});