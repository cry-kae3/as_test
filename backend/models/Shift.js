module.exports = (sequelize, DataTypes) => {
    const Shift = sequelize.define('Shift', {
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
        year: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 2000,
                max: 2100
            }
        },
        month: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 12
            }
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'draft',
            validate: {
                isIn: [['draft', 'confirmed']]
            }
        }
    }, {
        tableName: 'shifts',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['store_id', 'year', 'month']
            }
        ]
    });

    return Shift;
  };