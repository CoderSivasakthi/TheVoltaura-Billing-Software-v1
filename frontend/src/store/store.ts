import { configureStore } from '@reduxjs/toolkit';
import customerReducer from './slices/customerSlice';
import authReducer from './slices/authSlice';
import invoiceReducer from './slices/invoiceSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        customers: customerReducer,
        invoices: invoiceReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
