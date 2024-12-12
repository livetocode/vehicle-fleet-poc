import {loadConfig, VehiclesChart} from './main';
import {Testing} from 'cdk8s';

describe('Placeholder', () => {
  test('Empty', () => {
    const config = loadConfig('../../config.yaml');
    const app = Testing.app();
    const chart = new VehiclesChart(app, 'test-chart', config);
    const results = Testing.synth(chart)
    expect(results).toMatchSnapshot();
  });
});
