module.exports = (sequelize, DataTypes) => {
    const StaffDayOffRequest = sequelize.define('StaffDayOffRequest', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        staff_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'staff',
                key: 'id'
            }
        },
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        reason: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'pending',
            validate: {
                isIn: [['pending', 'approved', 'rejected']]
            }
        }
    }, {
        tableName: 'staff_day_off_requests',
        timestamps: true
    });

    return StaffDayOffRequest;
  };