import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { NotificationPreferencesForm } from './NotificationPreferencesForm';
import userSettingsQueryClient from '../queryClient';

function UserSettingsPageContent() {
    return (
        <div className="max-w-2xl mx-auto py-6 px-4">
            <div className="mb-4">
                <h1 className="text-xl font-semibold text-content-body">Notification settings</h1>
                <p className="text-sm text-content-body/60 mt-1">
                    Choose how you want to be notified for each type of activity.
                </p>
            </div>
            <NotificationPreferencesForm />
        </div>
    );
}

export default function UserSettingsPage() {
    return (
        <QueryClientProvider client={userSettingsQueryClient}>
            <UserSettingsPageContent />
        </QueryClientProvider>
    );
}
