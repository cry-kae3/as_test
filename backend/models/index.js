const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const User = require('./User')(sequelize, DataTypes);
const Session = require('./Session')(sequelize, DataTypes);
const Store = require('./Store')(sequelize, DataTypes);
const StoreClosedDay = require('./StoreClosedDay')(sequelize, DataTypes);
const StoreStaffRequirement = require('./StoreStaffRequirement')(sequelize, DataTypes);
const Staff = require('./Staff')(sequelize, DataTypes);
const StaffDayPreference = require('./StaffDayPreference')(sequelize, DataTypes);
const StaffDayOffRequest = require('./StaffDayOffRequest')(sequelize, DataTypes);
const Shift = require('./Shift')(sequelize, DataTypes);
const ShiftAssignment = require('./ShiftAssignment')(sequelize, DataTypes);
const ShiftChangeLog = require('./ShiftChangeLog')(sequelize, DataTypes);
const UserChangeLog = require('./UserChangeLog')(sequelize, DataTypes);
const BusinessHours = require('./BusinessHours')(sequelize, DataTypes);
const SystemSetting = require('./SystemSetting')(sequelize, DataTypes);

User.hasMany(Session, { foreignKey: 'user_id', as: 'sessions' });
Session.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Store.hasMany(StoreClosedDay, { foreignKey: 'store_id', as: 'closedDays' });
StoreClosedDay.belongsTo(Store, { foreignKey: 'store_id' });

Store.hasMany(StoreStaffRequirement, { foreignKey: 'store_id', as: 'staffRequirements' });
StoreStaffRequirement.belongsTo(Store, { foreignKey: 'store_id' });

Store.hasMany(Staff, { foreignKey: 'store_id', as: 'staff' });
Staff.belongsTo(Store, { foreignKey: 'store_id' });

Staff.belongsToMany(Store, {
    through: 'staff_stores',
    as: 'stores',
    foreignKey: 'staff_id',
    otherKey: 'store_id'
});

Store.belongsToMany(Staff, {
    through: 'staff_stores',
    as: 'availableStaff',
    foreignKey: 'store_id',
    otherKey: 'staff_id'
});

Staff.belongsToMany(Store, {
    through: 'staff_ai_generation_stores',
    as: 'aiGenerationStores',
    foreignKey: 'staff_id',
    otherKey: 'store_id'
});

Store.belongsToMany(Staff, {
    through: 'staff_ai_generation_stores',
    as: 'aiGenerationStaff',
    foreignKey: 'store_id',
    otherKey: 'staff_id'
});

Staff.hasMany(StaffDayPreference, { foreignKey: 'staff_id', as: 'dayPreferences' });
StaffDayPreference.belongsTo(Staff, { foreignKey: 'staff_id' });

Staff.hasMany(StaffDayOffRequest, { foreignKey: 'staff_id', as: 'dayOffRequests' });
StaffDayOffRequest.belongsTo(Staff, { foreignKey: 'staff_id', as: 'staff' });

Store.hasMany(Shift, { foreignKey: 'store_id', as: 'shifts' });
Shift.belongsTo(Store, { foreignKey: 'store_id' });

Shift.hasMany(ShiftAssignment, { foreignKey: 'shift_id', as: 'assignments' });
ShiftAssignment.belongsTo(Shift, { foreignKey: 'shift_id' });

Staff.hasMany(ShiftAssignment, { foreignKey: 'staff_id', as: 'assignments' });
ShiftAssignment.belongsTo(Staff, { foreignKey: 'staff_id' });

ShiftAssignment.hasMany(ShiftChangeLog, { foreignKey: 'shift_assignment_id', as: 'changeLogs' });
ShiftChangeLog.belongsTo(ShiftAssignment, { foreignKey: 'shift_assignment_id' });

User.hasMany(ShiftChangeLog, { foreignKey: 'user_id', as: 'changeLogs' });
ShiftChangeLog.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(UserChangeLog, { foreignKey: 'user_id', as: 'changesReceived' });
UserChangeLog.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(UserChangeLog, { foreignKey: 'admin_id', as: 'changesMade' });
UserChangeLog.belongsTo(User, { foreignKey: 'admin_id', as: 'admin' });

Store.hasMany(BusinessHours, { foreignKey: 'store_id', as: 'businessHours' });
BusinessHours.belongsTo(Store, { foreignKey: 'store_id' });

User.hasMany(User, { foreignKey: 'parent_user_id', as: 'children' });
User.belongsTo(User, { foreignKey: 'parent_user_id', as: 'parent' });

User.hasMany(Store, { foreignKey: 'owner_id', as: 'ownedStores' });
Store.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

User.hasOne(SystemSetting, { foreignKey: 'user_id', as: 'systemSetting' });
SystemSetting.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
    sequelize,
    User,
    Session,
    Store,
    StoreClosedDay,
    StoreStaffRequirement,
    BusinessHours,
    Staff,
    StaffDayPreference,
    StaffDayOffRequest,
    Shift,
    ShiftAssignment,
    ShiftChangeLog,
    UserChangeLog,
    SystemSetting
};