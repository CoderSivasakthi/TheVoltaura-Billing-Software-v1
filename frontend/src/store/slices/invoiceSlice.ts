import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { api } from '../../services/api';

interface InvoiceState {
    invoices: any[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const initialState: InvoiceState = {
    invoices: [],
    status: 'idle',
    error: null,
};

export const fetchInvoices = createAsyncThunk('invoices/fetchInvoices', async () => {
    const data = await api('GET', '/api/invoices');
    // Sort Descending by createdAt (Latest first)
    const sorted = (data || []).sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
    return sorted;
});

const invoiceSlice = createSlice({
    name: 'invoices',
    initialState,
    reducers: {
        removeInvoiceLocal: (state, action: PayloadAction<string>) => {
            state.invoices = state.invoices.filter((i) => i.id !== action.payload);
        },
    },
    extraReducers(builder) {
        builder
            .addCase(fetchInvoices.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchInvoices.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.invoices = action.payload || [];
            })
            .addCase(fetchInvoices.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message || 'Failed to load invoices';
            });
    },
});

export const { removeInvoiceLocal } = invoiceSlice.actions;

export const selectAllInvoices = (state: any) => state.invoices.invoices;
export const selectInvoiceStatus = (state: any) => state.invoices.status;
export const selectInvoiceError = (state: any) => state.invoices.error;

export default invoiceSlice.reducer;
