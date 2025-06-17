const crypto = require('crypto');
const { Session, User } = require('../models');
const { Op } = require('sequelize');

class SessionService {
    generateSessionToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    async createSession(userId, userAgent = null, ipAddress = null) {
        const sessionToken = this.generateSessionToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const session = await Session.create({
            user_id: userId,
            session_token: sessionToken,
            expires_at: expiresAt,
            is_active: true,
            user_agent: userAgent,
            ip_address: ipAddress,
            last_activity: new Date()
        });

        return session;
    }

    async validateSession(sessionToken) {
        if (!sessionToken) {
            return null;
        }

        const session = await Session.findOne({
            where: {
                session_token: sessionToken,
                is_active: true,
                expires_at: {
                    [Op.gt]: new Date()
                }
            },
            include: [{
                model: User,
                as: 'user',
                where: {
                    is_active: true
                }
            }]
        });

        if (session) {
            await session.update({
                last_activity: new Date()
            });
        }

        return session;
    }

    async extendSession(sessionToken) {
        const session = await Session.findOne({
            where: {
                session_token: sessionToken,
                is_active: true
            }
        });

        if (session) {
            const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await session.update({
                expires_at: newExpiresAt,
                last_activity: new Date()
            });
        }

        return session;
    }

    async destroySession(sessionToken) {
        await Session.update(
            { is_active: false },
            {
                where: {
                    session_token: sessionToken
                }
            }
        );
    }

    async destroyAllUserSessions(userId) {
        await Session.update(
            { is_active: false },
            {
                where: {
                    user_id: userId,
                    is_active: true
                }
            }
        );
    }

    async cleanupExpiredSessions() {
        const result = await Session.destroy({
            where: {
                [Op.or]: [
                    {
                        expires_at: {
                            [Op.lt]: new Date()
                        }
                    },
                    {
                        is_active: false,
                        createdAt: {
                            [Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                        }
                    }
                ]
            }
        });

        console.log(`Cleaned up ${result} expired sessions`);
        return result;
    }

    async getUserActiveSessions(userId) {
        return await Session.findAll({
            where: {
                user_id: userId,
                is_active: true,
                expires_at: {
                    [Op.gt]: new Date()
                }
            },
            order: [['last_activity', 'DESC']]
        });
    }
}

module.exports = new SessionService();