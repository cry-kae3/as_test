import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';

import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import DialogService from 'primevue/dialogservice';

import 'primevue/resources/themes/lara-light-blue/theme.css';
import 'primevue/resources/primevue.min.css';
import 'primeicons/primeicons.css';
import '/node_modules/primeflex/primeflex.css';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import Card from 'primevue/card';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import Menubar from 'primevue/menubar';
import Panel from 'primevue/panel';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Checkbox from 'primevue/checkbox';
import RadioButton from 'primevue/radiobutton';
import FileUpload from 'primevue/fileupload';
import Tag from 'primevue/tag';
import Divider from 'primevue/divider';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import Sidebar from 'primevue/sidebar';
import Menu from 'primevue/menu';
import InputMask from 'primevue/inputmask';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import SelectButton from 'primevue/selectbutton';
import InputSwitch from 'primevue/inputswitch';
import Password from 'primevue/password';
import TriStateCheckbox from 'primevue/tristatecheckbox';

const app = createApp(App);

app.use(store);
app.use(router);

app.use(PrimeVue, {
    ripple: true,
    inputStyle: 'filled',
    pt: {
        datatable: {
            root: { class: 'p-datatable-custom' }
        }
    }
});

app.use(ToastService);
app.use(ConfirmationService);
app.use(DialogService);

app.component('Button', Button);
app.component('InputText', InputText);
app.component('Dropdown', Dropdown);
app.component('Calendar', Calendar);
app.component('DataTable', DataTable);
app.component('Column', Column);
app.component('Dialog', Dialog);
app.component('Card', Card);
app.component('Toast', Toast);
app.component('ConfirmDialog', ConfirmDialog);
app.component('Menubar', Menubar);
app.component('Panel', Panel);
app.component('TabView', TabView);
app.component('TabPanel', TabPanel);
app.component('Checkbox', Checkbox);
app.component('RadioButton', RadioButton);
app.component('FileUpload', FileUpload);
app.component('Tag', Tag);
app.component('Divider', Divider);
app.component('Message', Message);
app.component('ProgressSpinner', ProgressSpinner);
app.component('Sidebar', Sidebar);
app.component('Menu', Menu);
app.component('InputMask', InputMask);
app.component('InputNumber', InputNumber);
app.component('Textarea', Textarea);
app.component('SelectButton', SelectButton);
app.component('InputSwitch', InputSwitch);
app.component('Password', Password);
app.component('TriStateCheckbox', TriStateCheckbox);

app.config.globalProperties.$filters = {
    formatDate(value) {
        if (!value) return '';
        return new Date(value).toLocaleDateString('ja-JP');
    },
    formatDateTime(value) {
        if (!value) return '';
        return new Date(value).toLocaleString('ja-JP');
    },
    formatTime(value) {
        if (!value) return '';
        return value.substring(0, 5);
    }
};

app.mount('#app');