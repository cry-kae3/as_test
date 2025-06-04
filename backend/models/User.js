module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        username: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
            validate: {
                notEmpty: true,
                len: [3, 100]
            }
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true,
                notEmpty: true
            }
        },
        company_name: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        role: {
            type: DataTypes.STRING(50),
            allowNull: false,
            validate: {
                isIn: [['admin', 'owner', 'staff']]
            }
        },
        parent_user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
        }
    }, {
        tableName: 'users',
        timestamps: true
    });

    User.associate = function (models) {
        User.hasMany(models.Session, {
            foreignKey: 'user_id',
            as: 'sessions'
        });
    };

    return User;
};