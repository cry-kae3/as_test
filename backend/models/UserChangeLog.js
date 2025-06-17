module.exports = (sequelize, DataTypes) => {
    const UserChangeLog = sequelize.define('UserChangeLog', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        admin_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        change_type: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['create', 'update', 'delete']]
            }
        },
        field_changed: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        previous_value: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        new_value: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        change_reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        impersonation_mode: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        tableName: 'user_change_logs',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false
    });

    return UserChangeLog;
  };