import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { FeedChartsTab } from './charts/FeedChartsTab';
import { WeightChartsTab } from './charts/WeightChartsTab';

const Tab = createMaterialTopTabNavigator();

export const ChartsScreen = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Feeds" component={FeedChartsTab} />
      <Tab.Screen name="Weight" component={WeightChartsTab} />
    </Tab.Navigator>
  );
};
