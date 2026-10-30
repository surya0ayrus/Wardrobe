import { useLocation, useNavigate } from 'react-router'

/**
 * "Back" that returns to the page this one was opened from (the dashboard, a list with
 * its filters…), else to `fallback`. The opening page passes useFromHere() as the link's state:
 *
 *   <Link to={`/companies/${uuid}`} state={useFromHere('dashboard')}>  // on the dashboard
 *   const back = useBack('/companies', 'companies')                    // on the company page
 *   <PageHeader back={back} />   …   onSuccess: () => back.go()
 *
 * Going back restores that page's own state, so a list opened from the dashboard still goes
 * back to the dashboard afterwards.
 */
export function useBack(fallback, fallbackLabel) {
  const location = useLocation()
  const navigate = useNavigate()
  const from = location.state?.from

  return {
    label: from?.label ?? fallbackLabel,
    go: () => (from ? navigate(from.path, { state: from.state }) : navigate(fallback)),
  }
}

/** Link state that makes the next page's useBack() return here, labelled `label`. */
export function useFromHere(label) {
  const location = useLocation()
  return { from: { path: location.pathname + location.search, state: location.state, label } }
}
