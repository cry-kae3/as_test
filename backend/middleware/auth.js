const { User } = require('../models');
const sessionService = require('../services/sessionService');

const authenticateSession = async (req, res, next) => {
    const sessionToken = req.headers['x-session-token'] || req.cookies?.sessionToken;

    if (!sessionToken) {
        return res.status(401).json({ message: '認証が必要です' });
    }

    try {
        const session = await sessionService.validateSession(sessionToken);

        if (!session) {
            return res.status(401).json({ message: 'セッションが無効または期限切れです' });
        }

        const user = session.user;
        const impersonateUserId = req.headers['x-impersonate-user-id'];


        if (impersonateUserId && user.role === 'admin') {
            try {
                const impersonateUser = await User.findOne({
                    where: {
                        id: impersonateUserId,
                        is_active: true
                    }
                });
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

        req.sessionToken = sessionToken;
        next();
    } catch (error) {
        console.error('セッション検証エラー:', error);
        return res.status(401).json({ message: 'セッション検証に失敗しました' });
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

    console.log('isOwnerOrAdmin チェック:', {
        effectiveRole,
        userRole,
        originalUser: req.originalUser?.role
    });

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
    if (!req.user) {
        return res.status(401).json({ message: '認証されていません' });
    }

    const effectiveRole = req.originalUser ? req.originalUser.role : req.user.role;
    const userRole = req.user.role;

    console.log('isManager チェック:', {
        effectiveRole,
        userRole,
        originalUser: req.originalUser?.role
    });

    if (effectiveRole === 'admin' || userRole === 'owner' || userRole === 'staff') {
        next();
    } else {
        res.status(403).json({ message: '権限がありません' });
    }
};

module.exports = {
    authenticateSession,
    isAdmin,
    isOwnerOrAdmin,
    isAuthorized,
    isManager
};