import Homey from 'homey';
import axios, { AxiosError, AxiosInstance } from 'axios';
import * as https from 'https';
import { MyDevice } from './device';

export class MyDriver extends Homey.Driver {

  resetClient() {
    this.log('resetClient');
    this.saveToken(null);

    this.getDevices()
      .forEach(device => (device as MyDevice).fetchAndRestartTimer());
  }

  saveToken(token:string|null) {
    this.homey.settings.set("token", token);
  }

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {

    this.homey.settings.on('set', (key:string) => {
      this.log('settings.set');
      this.resetClient();
    });
    this.homey.settings.on('unset', (key:string) => {
      this.log('settings.unset');
      this.resetClient();
    });

    this.log('Driver has been initialized');
  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    this.log('onPairListDevices');

    // Get device information from Elvia, and return it to Homey as an array of devices with their name and data.
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

    let date = new Date();
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    let hour = date.getHours();

    let adjustedMonth;
    let adjustedDay;
    let adjustedHour;
    let adjustedPreviousHour;

    if (month < 10) adjustedMonth = "0" + month; else adjustedMonth = month.toString();
    if (day < 10) adjustedDay = "0" + day; else adjustedDay = day.toString();
    if (hour < 10) adjustedHour = "0" + hour; else adjustedHour = hour.toString();
    if (hour - 1 < 10) adjustedPreviousHour = "0" + (hour - 1); else adjustedPreviousHour = (hour - 1).toString();

    let devices: Array<any> = [];

    await axiosInstance.get(
      "/metervalues?startTime=" + year + "-" + adjustedMonth + "-" + adjustedDay + "T" + adjustedPreviousHour + ":00:00+02:00&endTime=" + year + "-" + adjustedMonth + "-" + adjustedDay + "T" + adjustedHour + ":00:00+02:00", {
        headers: {'Authorization': "Bearer " + tokenTemp},
      }
    ).then((res) => {
      devices = res?.data?.meteringpoints?.map((meteringpoint:any) => {
        return {
          name: meteringpoint?.meteringPointId,
          data: {
            id: meteringpoint?.meteringPointId,
          }
        };
      });
    }).catch(err => {
      console.log(err);
    });

    this.log(devices);

    return devices;
  }

}

module.exports = MyDriver;
