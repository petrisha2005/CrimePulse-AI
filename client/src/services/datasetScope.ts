const STORAGE_KEY = "crimepulse_active_dataset_id";

export const getActiveDatasetId = () => window.localStorage.getItem(STORAGE_KEY) || "";

export const setActiveDatasetId = (datasetId: string) => {
  if (datasetId) window.localStorage.setItem(STORAGE_KEY, datasetId);
  else window.localStorage.removeItem(STORAGE_KEY);
};
