module.exports = (sequelize, DataTypes) => {
    const ShiftChangeLog = sequelize.define('ShiftChangeLog', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        shift_assignment_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'shift_assignments',
                key: 'id'
            }
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
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
        previous_data: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        new_data: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        change_reason: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'shift_change_logs',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false
    });

    return ShiftChangeLog;
  };