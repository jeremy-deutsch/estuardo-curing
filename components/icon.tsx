import styles from "./shared.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faArrowUpFromBracket,
  faCheck,
  faChevronDown,
  faCircleCheck,
  faCopy,
  faDoorOpen,
  faEnvelope,
  faFileCsv,
  faLayerGroup,
  faList,
  faLocationDot,
  faMap,
  faPhone,
  faPlus,
  faSearch,
  faSliders,
  faUsers,
  faXmark,
  faArrowLeft,
  faArrowUpRightFromSquare,
  faArrowRightFromBracket,
  faRotateRight,
  faLock,
  faBan,
  faBars,
} from "@fortawesome/free-solid-svg-icons";
const icons = {
  arrow: faArrowRight,
  upload: faArrowUpFromBracket,
  check: faCheck,
  down: faChevronDown,
  cured: faCircleCheck,
  copy: faCopy,
  door: faDoorOpen,
  text: faEnvelope,
  file: faFileCsv,
  batches: faLayerGroup,
  list: faList,
  pin: faLocationDot,
  map: faMap,
  phone: faPhone,
  plus: faPlus,
  search: faSearch,
  filter: faSliders,
  voters: faUsers,
  close: faXmark,
  back: faArrowLeft,
  external: faArrowUpRightFromSquare,
  logout: faArrowRightFromBracket,
  refresh: faRotateRight,
  lock: faLock,
  disable: faBan,
  menu: faBars,
};
export function Icon({
  name,
  className = "",
}: {
  name: keyof typeof icons;
  className?: string;
}) {
  return (
    <FontAwesomeIcon
      icon={icons[name]}
      className={`${styles.icon} ${className}`}
      aria-hidden="true"
    />
  );
}
