import { QueryClient } from '@tanstack/react-query';

const userSettingsQueryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 30_000, refetchOnWindowFocus: false },
    },
});

export default userSettingsQueryClient;
