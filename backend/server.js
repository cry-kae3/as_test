// backend/server.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const bcrypt = require('bcryptjs');
const { logUserChange } = require('./middleware/changeLogger');
require('dotenv').config();

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'CLAUDE_API_KEY',
  'PORT',
  'NODE_ENV'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) process.exit(1);

const { sequelize, User } = require('./models');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT;

app.use(cors({
  exposedHeaders: ['Content-Length'],
  credentials: true
}));

app.use(morgan('dev'));
app.use(logUserChange);

// リクエストのサイズ制限を増やす
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ヘッダーサイズ制限を明示的に設定
app.use((req, res, next) => {
  if (req.connection && typeof req.connection.setMaxHeadersCount === 'function') {
    req.connection.setMaxHeadersCount(100); // デフォルトは40
  }
  next();
});

app.use('/api', routes);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

async function createInitialUsers() {
  try {
    const userCount = await User.count();
    if (userCount !== 0) return;

    const adminEnvVars = [
      'INITIAL_ADMIN_USERNAME',
      'INITIAL_ADMIN_PASSWORD',
      'INITIAL_ADMIN_EMAIL',
      'INITIAL_ADMIN_ROLE'
    ];
    const missingAdminVars = adminEnvVars.filter(envVar => !process.env[envVar]);
    if (missingAdminVars.length > 0) return;

    const hashedPassword = await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD, 10);
    await User.create({
      username: process.env.INITIAL_ADMIN_USERNAME,
      password: hashedPassword,
      email: process.env.INITIAL_ADMIN_EMAIL,
      role: process.env.INITIAL_ADMIN_ROLE
    });

    if (process.env.CREATE_MANAGER_USER === 'true') {
      const managerEnvVars = [
        'INITIAL_MANAGER_USERNAME',
        'INITIAL_MANAGER_PASSWORD',
        'INITIAL_MANAGER_EMAIL'
      ];
      const missingManagerVars = managerEnvVars.filter(envVar => !process.env[envVar]);
      if (missingManagerVars.length > 0) return;

      const managerHashedPassword = await bcrypt.hash(process.env.INITIAL_MANAGER_PASSWORD, 10);
      await User.create({
        username: process.env.INITIAL_MANAGER_USERNAME,
        password: managerHashedPassword,
        email: process.env.INITIAL_MANAGER_EMAIL,
        role: 'manager'
      });
    }
  } catch (_) { }
}

async function startServer() {
  try {
    await sequelize.authenticate();

    if (process.env.NODE_ENV === 'development') {
      const syncOptions = {};
      if (process.env.RESET_DB === 'true') {
        syncOptions.force = true;
      } else {
        syncOptions.alter = true;
      }
      await sequelize.sync(syncOptions);
      await createInitialUsers();
    } else {
      await createInitialUsers();
    }

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

startServer();