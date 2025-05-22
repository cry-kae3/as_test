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

        const impersonateUserId = req.headers['x-impersonate-user-id'];

        console.log('認証ミドルウェア:', {
            originalUserId: user.id,
            originalUserRole: user.role,
            impersonateUserId: impersonateUserId
        });

        if (impersonateUserId && user.role === 'admin') {
            try {
                const impersonateUser = await User.findByPk(impersonateUserId);
                if (impersonateUser) {
                    console.log('なりすまし有効:', {
                        impersonateUserId: impersonateUser.id,
                        impersonateUserRole: impersonateUser.role
                    });
                    req.user = impersonateUser;
                    req.originalUser = user;
                    req.isImpersonating = true;
                } else {
                    console.log('なりすまし対象ユーザーが見つからない');
                    req.user = user;
                }
            } catch (error) {
                console.error('なりすまし処理エラー:', error);
                req.user = user;
            }
        } else {
            req.user = user;
        }

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

    const effectiveRole = req.originalUser ? req.originalUser.role : req.user.role;

    if (effectiveRole !== 'admin') {
        return res.status(403).json({ message: '管理者権限が必要です' });
    }

    next();
};

const isOwnerOrAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: '認証されていません' });
    }

    const effectiveRole = req.originalUser ? req.originalUser.role : req.user.role;
    const userRole = req.user.role;

    if (effectiveRole === 'admin' || userRole === 'owner') {
        next();
    } else {
        res.status(403).json({ message: 'オーナーまたは管理者権限が必要です' });
    }
};

const isAuthorized = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: '認証されていません' });
    }

    const userRole = req.user.role;

    if (userRole === 'staff' || userRole === 'owner' || (req.originalUser && req.originalUser.role === 'admin')) {
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