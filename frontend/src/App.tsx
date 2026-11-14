import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import { NotFoundPage } from '@/components/NotFoundPage';
import { AgentDetailPage } from '@/agents/AgentDetailPage';
import { AgentsPage } from '@/agents/AgentsPage';
import { ApprovalsPage } from '@/approvals/ApprovalsPage';
import { AuditPage } from '@/audit/AuditPage';
import { OverviewPage } from '@/dashboard/OverviewPage';
import { PoliciesPage } from '@/policies/PoliciesPage';
import { LiveProvider } from '@/lib/live';
import { ThemeProvider } from '@/lib/theme';
import { ToastProvider } from '@/lib/toast';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <LiveProvider>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<OverviewPage />} />
                  <Route path="agents" element={<AgentsPage />} />
                  <Route path="agents/:id" element={<AgentDetailPage />} />
                  <Route path="policies" element={<PoliciesPage />} />
                  <Route path="approvals" element={<ApprovalsPage />} />
                  <Route path="audit" element={<AuditPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </LiveProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
