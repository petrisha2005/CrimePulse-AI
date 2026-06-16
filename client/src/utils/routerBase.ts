export const getRouterBasename = () => (window.location.pathname.startsWith("/app") ? "/app" : "/");

export const withRouterBase = (path: string) => {
  const basename = getRouterBasename();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return basename === "/" ? normalizedPath : `${basename}${normalizedPath}`;
};
