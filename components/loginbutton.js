import { useRouter } from 'next/router';
import { FaSignInAlt, FaSignOutAlt } from 'react-icons/fa';
import getBaseURL from "../hooks/getbaseurl";
import logout from "../hooks/logout";
import { MenuButton } from './recorderstyles';

export default function LoginButton({ user, jwt, ...props }) {

  let uxme = false;
  // TODO: This is hacky
  if (user?.provider === "supabase")
    uxme = true;

  const router = useRouter();

  const handleLogoutClick = async (e) => {
    e.preventDefault();
    const success = await logout(router);
    if (success) {
      router.push('/');
    }
  };

  let link = uxme ? (process.env.NEXT_PUBLIC_UX4ME_URL || "#") : jwt ? "#" : getBaseURL() + "/api/connect/google";
  const label = uxme ? "UX4ME" : jwt ? "Logout" : "Login";
  const Icon = jwt ? FaSignOutAlt : FaSignInAlt;

  return (
    <div {...props}>
      <a
        href={link}
        onClick={(jwt && !uxme) ? handleLogoutClick : null}
        title={label}
        style={{ textDecoration: 'none' }}
      >
        <MenuButton>
          <Icon />
        </MenuButton>
      </a>
    </div>
  );
}