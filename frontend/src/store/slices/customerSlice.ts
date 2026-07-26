import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { api } from '../../services/api';

interface CustomerState {
    customers: any[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const initialState: CustomerState = {
    customers: [],
    status: 'idle',
    error: null,
};

// Async data payload function 
export const fetchCustomers = createAsyncThunk('customers/fetchCustomers', async () => {
    const response = await api('GET', '/api/customers');
    return response;
});

const customerSlice = createSlice({
    name: 'customers',
    initialState,
    reducers: {
        // Synchronous payload action examples
        addCustomerLocal: (state, action: PayloadAction<any>) => {
            state.customers.push(action.payload);
        },
        removeCustomerLocal: (state, action: PayloadAction<string>) => {
            state.customers = state.customers.filter((c) => c.id !== action.payload);
        },
    },
    extraReducers(builder) {
        builder
            .addCase(fetchCustomers.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchCustomers.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.customers = action.payload || [];
            })
            .addCase(fetchCustomers.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message || 'Failed to load customers';
            });
    },
});

export const { addCustomerLocal, removeCustomerLocal } = customerSlice.actions;

// Selectors
export const selectAllCustomers = (state: any) => state.customers.customers;
export const selectCustomerStatus = (state: any) => state.customers.status;

export default customerSlice.reducer;
