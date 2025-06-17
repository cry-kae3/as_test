// store/index.js
import { createStore } from 'vuex';
import auth from './modules/auth';
import staff from './modules/staff';
import store from './modules/store';
import shift from './modules/shift';

export default createStore({
    modules: {
        auth,
        staff,
        store,
        shift
    }
});