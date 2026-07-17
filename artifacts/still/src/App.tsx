import { useEffect, lazy, Suspense } from "react";
import {
  Switch,
  Route,
  Redirect,
  Router as WouterRouter,
  useLocation,
} from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Paste from "@/pages/paste";
import Entries from "@/pages/entries";
import Processing from "@/pages/processing";
import Result from "@/pages/result";
import History from "@/pages/history";
import Login from "@/pages/login";
import Why from "@/pages/why";
import Philosophy from "@/pages/philosophy";
import Pricing from "@/pages/pricing";
import PrivacyPolicy from "@/pages/privacy-policy";
import Terms from "@/pages/terms";
import VerifyEmail from "@/pages/verify-email";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Today from "@/pages/today";
import Library from "@/pages/library";
import EntryDetail from "@/pages/entry-detail";
import Returns from "@/pages/returns";
import LookBack from "@/pages/look-back";
import Timeline from "@/pages/timeline";
import Letter from "@/pages/letter";
import Calendar from "@/pages/calendar";
import Book from "@/pages/book";
import Shelf from "@/pages/shelf";
import Capsules from "@/pages/capsules";
import CollectionsPage from "@/pages/collections";
import CollectionDetail from "@/pages/collection-detail";
import Import from "@/pages/import";
import Settings from "@/pages/settings";
import Profile from "@/pages/profile";
import Plan from "@/pages/plan";
import Shop from "@/pages/shop";
import ShopProduct from "@/pages/shop-product";
import Privacy from "@/pages/privacy";
import Notifications from "@/pages/notifications";
import Resurfacing from "@/pages/resurfacing";
import Onboarding from "@/pages/onboarding";

import { StillProvider } from "@/lib/store";
import { AuthProvider, useAuth } from "@/lib/auth";
import { DevPanel } from "@/components/dev-panel";
import { QuotaPromptProvider } from "@/components/quota-prompt-dialog";
import { CartProvider } from "@/lib/use-cart";
import { CartDrawer } from "@/components/cart-drawer";

const queryClient = new QueryClient();

// Help renders a heavy markdown stack (react-markdown + remark/rehype). Lazy-load
// it so that runtime stays out of the main bundle and only loads when /help opens.
const Help = lazy(() => import("@/pages/help"));

function LoadingScreen() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center">
      <span className="text-faint-ink animate-pulse">Yadegar…</span>
    </div>
  );
}

// Everything except /login lives behind authentication.
function ProtectedApp() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user && location !== "/login") {
      setLocation("/login");
    }
    // First run: send authenticated-but-not-onboarded users to onboarding.
    if (
      !isLoading &&
      user &&
      !user.onboardingCompleted &&
      location !== "/onboarding"
    ) {
      setLocation("/onboarding");
    }
  }, [isLoading, user, location, setLocation]);

  if (isLoading) return <LoadingScreen />;
  if (!user) return null; // redirecting to /login

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Switch>
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/">
        <Redirect to="/today" />
      </Route>
      <Route path="/today" component={Today} />
      <Route path="/library" component={Library} />
      <Route path="/library/:entryId" component={EntryDetail} />
      <Route path="/returns" component={Returns} />
      <Route path="/look-back" component={LookBack} />
      <Route path="/look-back/:lens" component={LookBack} />
      <Route path="/timeline" component={Timeline} />
      {/* Search merged into Library (its search box). Keep the path working. */}
      <Route path="/search">
        <Redirect to="/library" />
      </Route>
      <Route path="/letters/:year" component={Letter} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/book" component={Book} />
      <Route path="/shelf" component={Shelf} />
      <Route path="/capsules" component={Capsules} />
      <Route path="/collections" component={CollectionsPage} />
      <Route path="/collections/:id" component={CollectionDetail} />
      <Route path="/import" component={Import} />
      <Route path="/settings" component={Settings} />
      <Route path="/help" component={Help} />
      <Route path="/settings/profile" component={Profile} />
      <Route path="/settings/plan" component={Plan} />
      <Route path="/settings/notifications" component={Notifications} />
      <Route path="/settings/resurfacing" component={Resurfacing} />
      <Route path="/settings/privacy" component={Privacy} />
      {/* Legacy prototype flow (engine read-across), not in the primary nav. */}
      <Route path="/home" component={Home} />
      <Route path="/paste" component={Paste} />
      <Route path="/entries" component={Entries} />
      <Route path="/processing" component={Processing} />
      <Route path="/result" component={Result} />
      <Route path="/history" component={History} />
      <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// /login redirects to home when the visitor is already signed in.
function LoginRoute() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user) setLocation("/");
  }, [isLoading, user, setLocation]);

  if (isLoading) return <LoadingScreen />;
  if (user) return null;
  return <Login />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginRoute} />
      <Route path="/why" component={Why} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/shop" component={Shop} />
      <Route path="/shop/:handle" component={ShopProduct} />
      <Route path="/philosophy" component={Philosophy} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms" component={Terms} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route component={ProtectedApp} />
    </Switch>
  );
}

function SvgNoise() {
  return (
    <svg className="noise-overlay" xmlns="http://www.w3.org/2000/svg">
      <filter id="noiseFilter">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.8"
          numOctaves="3"
          stitchTiles="stitch"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#noiseFilter)" />
    </svg>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StillProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <SvgNoise />
              <CartProvider>
                <QuotaPromptProvider>
                  <Router />
                </QuotaPromptProvider>
                <CartDrawer />
              </CartProvider>
              <DevPanel />
            </AuthProvider>
          </WouterRouter>
        </StillProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
