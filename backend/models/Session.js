module.exports = (sequelize, DataTypes) => {
    const Session = sequelize.define('Session', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        session_token: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
        },
        user_agent: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        ip_address: {
            type: DataTypes.STRING(45),
            allowNull: true
        },
        last_activity: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: false
        }
    }, {
        tableName: 'sessions',
        timestamps: true,
        indexes: [
            {
                fields: ['session_token'],
                unique: true
            },
            {
                fields: ['user_id']
            },
            {
                fields: ['expires_at']
            },
            {
                fields: ['is_active']
            }
        ]
    });

    Session.associate = function (models) {
        Session.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    };

    return Session;
};