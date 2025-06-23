module.exports = (sequelize, DataTypes) => {
    const Staff = sequelize.define('Staff', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        store_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'stores',
                key: 'id'
            }
        },
        first_name: {
            type: DataTypes.STRING(50),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        last_name: {
            type: DataTypes.STRING(50),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        furigana: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        gender: {
            type: DataTypes.STRING(10),
            allowNull: true
        },
        position: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        employment_type: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        max_hours_per_month: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {
                min: 0
            }
        },
        min_hours_per_month: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {
                min: 0
            }
        },
        max_hours_per_day: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {
                min: 0,
                max: 24
            }
        }
    }, {
        tableName: 'staff',
        timestamps: true
    });

    Staff.prototype.getFullName = function () {
        return `${this.last_name} ${this.first_name}`;
    };

    Staff.associate = function (models) {
        Staff.belongsToMany(models.Store, {
            through: 'staff_stores',
            as: 'stores',
            foreignKey: 'staff_id',
            otherKey: 'store_id'
        });
    };

    return Staff;
};