const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

class AuthService {
    // JWTトークンを生成
    generateToken(user) {
        return jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
    }

    // パスワードをハッシュ化
    async hashPassword(password) {
        const salt = await bcrypt.genSalt(10);
        return bcrypt.hash(password, salt);
    }

    // パスワードを検証
    async comparePassword(password, hashedPassword) {
        return bcrypt.compare(password, hashedPassword);
    }

    // ユーザーを作成（管理者用）
    async createUser(userData) {
        // パスワードをハッシュ化
        const hashedPassword = await this.hashPassword(userData.password);

        // ユーザーを作成
        const user = await User.create({
            ...userData,
            password: hashedPassword
        });

        // パスワードを除外してユーザー情報を返す
        const { password, ...userWithoutPassword } = user.get({ plain: true });
        return userWithoutPassword;
    }

    // ユーザー認証
    async authenticateUser(username, password) {
        // ユーザー検索
        const user = await User.findOne({ where: { username } });

        if (!user) {
            throw new Error('ユーザー名またはパスワードが正しくありません');
        }

        // パスワード検証
        const isPasswordValid = await this.comparePassword(password, user.password);

        if (!isPasswordValid) {
            throw new Error('ユーザー名またはパスワードが正しくありません');
        }

        // トークン生成
        const token = this.generateToken(user);

        // パスワードを除外してユーザー情報を返す
        const { password: _, ...userWithoutPassword } = user.get({ plain: true });

        return {
            token,
            user: userWithoutPassword
        };
    }

    // トークンを検証してユーザー情報を取得
    async verifyToken(token) {
        try {
            // トークンを検証
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // ユーザーを取得
            const user = await User.findByPk(decoded.id);

            if (!user) {
                throw new Error('ユーザーが見つかりません');
            }

            // パスワードを除外してユーザー情報を返す
            const { password, ...userWithoutPassword } = user.get({ plain: true });

            return userWithoutPassword;
        } catch (error) {
            throw new Error('トークンが無効です: ' + error.message);
        }
    }
}

module.exports = new AuthService();