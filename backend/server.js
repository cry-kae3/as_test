const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const { logUserChange } = require('./middleware/changeLogger');
const sessionService = require('./services/sessionService');
require('dotenv').config();

const requiredEnvVars = [
  'CLAUDE_API_KEY',
  'API_PORT',
  'INITIAL_ADMIN_USERNAME',
  'INITIAL_ADMIN_PASSWORD',
  'INITIAL_ADMIN_EMAIL'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

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

    console.log('Creating initial admin user...');
    const hashedPassword = await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD, 10);
    await User.create({
      username: process.env.INITIAL_ADMIN_USERNAME,
      password: hashedPassword,
      email: process.env.INITIAL_ADMIN_EMAIL,
      role: process.env.INITIAL_ADMIN_ROLE,
      is_active: true
    });
    console.log('Initial admin user created');

    if (process.env.CREATE_NORMAL_USER === 'true') {
      console.log('Creating initial owner user...');
      const ownerHashedPassword = await bcrypt.hash(process.env.INITIAL_USER_PASSWORD, 10);
      await User.create({
        username: process.env.INITIAL_USER_USERNAME,
        password: ownerHashedPassword,
        email: process.env.INITIAL_USER_EMAIL,
        company_name: process.env.INITIAL_USER_COMPANY,
        role: process.env.INITIAL_USER_ROLE,
        is_active: true
      });
      console.log('Initial owner user created');
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
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('Database connection successful');

    if (process.env.NODE_ENV === 'development') {
      console.log('Syncing database...');
      const syncOptions = {};
      if (process.env.RESET_DB === 'true') {
        syncOptions.force = true;
      } else {
        syncOptions.alter = true;
      }
      await sequelize.sync(syncOptions);
      console.log('Database sync complete');
      await createInitialUsers();
    } else {
      await createInitialUsers();
    }

    startSessionCleanup();

    app.listen(API_PORT, () => {
      console.log(`Server is running on port ${API_PORT}`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

startServer();