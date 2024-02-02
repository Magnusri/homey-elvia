import Homey from 'homey';
import axios, { AxiosError, AxiosInstance } from 'axios';
import * as https from 'https';
import moment from 'moment';
import { MyDriver } from './driver';

export class MyDevice extends Homey.Device {

  id: string = this.getData().id;
  driver: MyDriver = this.driver as MyDriver;
  timer: NodeJS.Timer|null = null; 

  async setCap<T>(name:string, value:T) {
    let current = this.getCapabilityValue(name);
    if (value == current)
      return;
    this.log("setCapabilityValue("+name+", "+value+")");
    await this.setCapabilityValue(name, value);
  }
  
  async fetchFromService() {
    try {
      let axiosInstance: AxiosInstance;

      axiosInstance = axios.create({
        baseURL: "https://elvia.azure-api.net/customer/metervalues/api/v1",
      });
      
      const agent = new https.Agent({
        rejectUnauthorized: false,
      });

      axiosInstance.defaults.httpsAgent = agent;
      axiosInstance.defaults.headers.common['Content-Type'] = 'application/json';

      let tokenTemp = this.homey.settings.get("token");

      let momentNow = moment();
      let momentDateNow = momentNow.subtract(1, 'hours').format('YYYY-MM-DDTHH:00:00+00:00');
      let momentPreviousHour = momentNow.subtract(1, 'hours').format('YYYY-MM-DDTHH:00:00+00:00');

      let consumption = -255;

      await axiosInstance.get(
        `/metervalues?startTime=${momentPreviousHour}&endTime=${momentDateNow}`, {
          headers: {'Authorization': "Bearer " + tokenTemp},
        }
      ).then((res) => {
        let meteringpoint = res?.data?.meteringpoints?.find((meteringpoint:any) => meteringpoint?.meteringPointId == this.id);
        let meteringValue = meteringpoint?.metervalue?.timeSeries?.[0]?.value;
        consumption = meteringValue;
      }).catch(err => {
        console.log(err);
      });

      if (consumption != undefined && consumption != -255) {
        this.setCap('measure_power', consumption * 1000);
      }
      
      return true; // Might need to return device
    } catch (e) {
      if (e instanceof Error)
        await this.setWarning(e.message);
      throw e;
    }
  }

  async fetchAndRestartTimer() {
    if (this.timer)
      this.homey.clearInterval(this.timer);
    await this.fetchFromService();
    this.timer = this.homey.setInterval(() => this.fetchFromService(), 60000);
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    try {
      await this.fetchAndRestartTimer();
    }
    catch (e) {
      if (e instanceof Error)
        await this.setWarning(e.message);
      else 
        throw e;
    }

    this.log("Device '"+this.id+"' has been initialized");
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Device has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings: {}, newSettings: {}, changedKeys: [] }): Promise<string|void> {
    this.log('Device settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onDeleted() {
    if (this.timer)
      clearInterval(this.timer as NodeJS.Timeout);
    this.log('Device has been deleted');
  }

}

module.exports = MyDevice;
