import { useFonts as useExpoFonts } from 'expo-font';
import {
  Montserrat_300Light,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  Montserrat_900Black,
} from '@expo-google-fonts/montserrat';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_800ExtraBold,
  PlayfairDisplay_900Black,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_700Bold_Italic,
} from '@expo-google-fonts/playfair-display';

export const useFonts = () => {
  const [fontsLoaded] = useExpoFonts({
    // Montserrat for body text
    'Montserrat-Light': Montserrat_300Light,
    'Montserrat-Regular': Montserrat_400Regular,
    'Montserrat-Medium': Montserrat_500Medium,
    'Montserrat-SemiBold': Montserrat_600SemiBold,
    'Montserrat-Bold': Montserrat_700Bold,
    'Montserrat-ExtraBold': Montserrat_800ExtraBold,
    'Montserrat-Black': Montserrat_900Black,
    // Playfair Display for elegant headers
    'Playfair-Regular': PlayfairDisplay_400Regular,
    'Playfair-Medium': PlayfairDisplay_500Medium,
    'Playfair-SemiBold': PlayfairDisplay_600SemiBold,
    'Playfair-Bold': PlayfairDisplay_700Bold,
    'Playfair-ExtraBold': PlayfairDisplay_800ExtraBold,
    'Playfair-Black': PlayfairDisplay_900Black,
    'Playfair-Italic': PlayfairDisplay_400Regular_Italic,
    'Playfair-BoldItalic': PlayfairDisplay_700Bold_Italic,
    // Victory Striker Sans for page headers (sports/bold style)
    'VictoryStriker': require('../../assets/fonts/Victory Striker Sans Demo.otf'),
    // Milker font for luxury titles
    'Milker': require('../../assets/fonts/Milker.otf'),
  });

  return fontsLoaded;
};

// Font family constants for consistent usage
export const fonts = {
  // Body/UI fonts (Montserrat)
  light: 'Montserrat-Light',
  regular: 'Montserrat-Regular',
  medium: 'Montserrat-Medium',
  semiBold: 'Montserrat-SemiBold',
  bold: 'Montserrat-Bold',
  extraBold: 'Montserrat-ExtraBold',
  black: 'Montserrat-Black',
  // Display/Header fonts (Playfair - elegant serif)
  display: 'Playfair-Bold',
  displayRegular: 'Playfair-Regular',
  displayMedium: 'Playfair-Medium',
  displaySemiBold: 'Playfair-SemiBold',
  displayBold: 'Playfair-Bold',
  displayExtraBold: 'Playfair-ExtraBold',
  displayBlack: 'Playfair-Black',
  displayItalic: 'Playfair-Italic',
  displayBoldItalic: 'Playfair-BoldItalic',
  // Victory Striker Sans for page titles (legacy)
  striker: 'VictoryStriker',
  // Milker - luxury display font for all page titles
  milker: 'Milker',
};

export default useFonts;
