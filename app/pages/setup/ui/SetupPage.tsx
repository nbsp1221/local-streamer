import { useSetupView } from '~/widgets/setup-view/model/useSetupView';
import { SetupView } from '~/widgets/setup-view/ui/SetupView';

/**
 * Setup page composition layer
 * Connects business logic hook with presentation component
 */
export function SetupPage() {
  const view = useSetupView();

  return <SetupView {...view} />;
}
