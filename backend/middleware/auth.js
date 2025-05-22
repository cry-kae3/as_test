const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authenticateJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: '認証トークンが必要です' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findByPk(decoded.id);

        if (!user) {
            return res.status(404).json({ message: 'ユーザーが見つかりません' });
        }

        req.user = user;

        next();
    } catch (error) {
        console.error('JWT検証エラー:', error);
        return res.status(403).json({ message: '無効なトークンです' });
    }
};

const isAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: '認証されていません' });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: '管理者権限が必要です' });
    }

    next();
};

const isOwnerOrAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'owner')) {
        next();
    } else {
        res.status(403).json({ message: 'オーナーまたは管理者権限が必要です' });
    }
};

const isAuthorized = (req, res, next) => {
    if (req.user && (req.user.role === 'staff' || req.user.role === 'owner' || req.user.role === 'admin')) {
        next();
    } else {
        res.status(403).json({ message: '権限がありません' });
    }
};

const isManager = (req, res, next) => {
    return isAuthorized(req, res, next);
};

module.exports = {
    authenticateJWT,
    isAdmin,
    isOwnerOrAdmin,
    isAuthorized,
    isManager
};