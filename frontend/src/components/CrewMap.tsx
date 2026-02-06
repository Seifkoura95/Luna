// Platform-specific export - automatically selects native or web version
import { Platform } from 'react-native';

// Export the appropriate component based on platform
export { CrewMapWeb as CrewMap } from './CrewMapWeb';
export { default } from './CrewMapWeb';
