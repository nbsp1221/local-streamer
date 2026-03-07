import { useSetupView } from '~/legacy/widgets/setup-view/model/useSetupView';
import { SetupView } from '~/legacy/widgets/setup-view/ui/SetupView';

/**
 * Setup page composition layer
 * Connects business logic hook with presentation component
 */
export function SetupPage() {
  const view = useSetupView();

  return <SetupView {...view} />;
}
