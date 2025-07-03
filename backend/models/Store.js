module.exports = (sequelize, DataTypes) => {
    const Store = sequelize.define('Store', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        address: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        phone: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: true,
            validate: {
                isEmail: true
            }
        },
        opening_time: {
            type: DataTypes.TIME,
            allowNull: false
        },
        closing_time: {
            type: DataTypes.TIME,
            allowNull: false
        },
        owner_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        area: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        postal_code: {
            type: DataTypes.STRING(20),
            allowNull: true
        }
    }, {
        tableName: 'stores',
        timestamps: true
    });

    Store.associate = function (models) {
        Store.hasMany(models.BusinessHours, {
            foreignKey: 'store_id',
            as: 'businessHours'
        });
    };

    return Store;
};