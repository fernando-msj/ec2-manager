const AWS = require("aws-sdk");
const moment = require("moment");
const { INSTANCE_ID } = require("./auth.json");
const { INSTANCE_STATUS_CODES } = require("./constants");

const EC2 = new AWS.EC2();

EC2.describeInstances({ InstanceIds: [INSTANCE_ID] }, (error, result) => {
  if (error) {
    throw error;
  }

  if (result.Reservations.length > 1) {
    console.error("There is more than one Reservations!");
    console.log(inspect(result, true, 9e9, true));
  }

  if (result.Reservations[0].Instances.length > 1) {
    console.error("There is more than one Instances!");
    console.log(inspect(result, true, 9e9, true));
  }

  const instance = result.Reservations[0].Instances[0];

  if (instance.State.Code === INSTANCE_STATUS_CODES.RUNNING) {
    console.log(`Instance ${instance.InstanceId}:
  * Instance Type: ${instance.InstanceType}
  * Running at: ${instance.PublicDnsName} (${instance.PublicIpAddress})
  * Region: ${instance.Placement.AvailabilityZone}
  * Status: ${instance.State.Name}
  * Started: ${moment(instance.LaunchTime).format("DD/MM HH:mma")} (${moment(
      instance.LaunchTime
    ).fromNow()})
    `);
  } else if (instance.State.Code === INSTANCE_STATUS_CODES.STOPPED) {
    console.log(`Instance ${instance.InstanceId} is stopped`);
  } else {
    console.log(
      `Instance ${instance.InstanceId} status: ${instance.State.Name} (${instance.State.Code})`
    );
  }
});
