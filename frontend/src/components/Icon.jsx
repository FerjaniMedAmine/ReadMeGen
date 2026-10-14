import PropTypes from "prop-types";

const paths = {
  document: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 13h8M8 17h5",
  upload: "M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4",
  git: "M6 3v12a4 4 0 0 0 4 4h4M18 6v5a4 4 0 0 1-4 4H6M8 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM18 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  sparkle: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  check: "m5 12 4 4L19 6",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  copy: "M9 8h11v13H9ZM15 8V3H4v13h5",
  plus: "M12 5v14M5 12h14",
  lock: "M5 10h14v11H5Zm3 0V6a4 4 0 0 1 8 0v4M12 14v3",
  chevron: "m6 9 6 6 6-6",
  external: "M14 3h7v7m0-7L10 14M10 3H3v18h18v-7",
};

export default function Icon({ name, size = 18, className = "" }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[name] || paths.document} />
  </svg>;
}

Icon.propTypes = { name: PropTypes.string.isRequired, size: PropTypes.number, className: PropTypes.string };
