const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const bcrypt = require('bcryptjs');
const { logUserChange } = require('./middleware/changeLogger');
require('dotenv').config();

const requiredEnvVars = [
  'JWT_SECRET',
  'CLAUDE_API_KEY',
  'API_PORT'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

const { sequelize, User } = require('./models');
const routes = require('./routes');

const app = express();
const API_PORT = process.env.API_PORT || 3000;

app.use(cors({
  exposedHeaders: ['Content-Length'],
  credentials: true
}));

app.use(morgan('dev'));
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
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.create({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@example.com',
      role: 'admin'
    });
    console.log('Initial admin user created');

    console.log('Creating test owner user...');
    const ownerHashedPassword = await bcrypt.hash('owner123', 10);
    await User.create({
      username: 'owner1',
      password: ownerHashedPassword,
      email: 'owner1@example.com',
      company_name: '株式会社テスト1',
      role: 'owner'
    });
    console.log('Test owner user created');

  } catch (error) {
    console.error('Error creating initial users:', error);
  }
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

    app.listen(API_PORT, () => {
      console.log(`Server is running on port ${API_PORT}`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

startServer();