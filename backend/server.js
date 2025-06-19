require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const { logUserChange } = require('./middleware/changeLogger');
const sessionService = require('./services/sessionService');
const { seedStaffRequirements } = require('./services/seeder');

const { sequelize, User } = require('./models');
const routes = require('./routes');

const app = express();
const API_PORT = process.env.API_PORT;

app.use(cors({
  exposedHeaders: ['Content-Length'],
  credentials: true
}));

app.use(morgan('dev'));
app.use(cookieParser());
app.use(logUserChange);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  if (req.connection && typeof req.connection.setMaxHeadersCount === 'function') {
    req.connection.setMaxHeadersCount(100);
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

    const hashedPassword = await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD, 10);
    await User.create({
      username: process.env.INITIAL_ADMIN_USERNAME,
      password: hashedPassword,
      email: process.env.INITIAL_ADMIN_EMAIL,
      role: process.env.INITIAL_ADMIN_ROLE,
      is_active: true
    });

    if (process.env.CREATE_NORMAL_USER === 'true') {
      const ownerHashedPassword = await bcrypt.hash(process.env.INITIAL_USER_PASSWORD, 10);
      await User.create({
        username: process.env.INITIAL_USER_USERNAME,
        password: ownerHashedPassword,
        email: process.env.INITIAL_USER_EMAIL,
        company_name: process.env.INITIAL_USER_COMPANY,
        role: process.env.INITIAL_USER_ROLE,
        is_active: true
      });
    }

  } catch (error) {
    console.error('Error creating initial users:', error);
  }
}

async function startSessionCleanup() {
  const cleanupInterval = 60 * 60 * 1000;

  const cleanup = async () => {
    try {
      await sessionService.cleanupExpiredSessions();
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  };

  setInterval(cleanup, cleanupInterval);
  cleanup();
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
      await seedStaffRequirements();
    } else {
      await createInitialUsers();
      await seedStaffRequirements();
    }

    startSessionCleanup();

    app.listen(API_PORT, () => {
      console.log(`サーバーがポート${API_PORT}で起動しました。`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

startServer();