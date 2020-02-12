const AWS = require("aws-sdk");

const { INSTANCE_STATUS_CODES } = require("./constants");
const { INSTANCE_ID } = require("./auth.json");
const { POLL_INTERVAL, MAX_POOL_REQUESTS } = require("./config.json");

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

  if (instance.State.Code !== INSTANCE_STATUS_CODES.RUNNING) {
    console.warn(
      "The instance is not on running state! Current Status: ",
      instance.State.Name
    );
    return;
  }

  EC2.stopInstances(
    {
      InstanceIds: [INSTANCE_ID]
    },
    (err, res) => {
      if (err) {
        throw err;
      }

      if (res.StoppingInstances.length > 1) {
        console.warn("There is more than one stopping instance!");
        console.log(inspect(res.StoppingInstances, true, 9e9, true));
      }

      const mainInstance = res.StoppingInstances[0];

      console.log(
        `Switching instance ${mainInstance.InstanceId} from ${mainInstance.PreviousState.Name} to ${mainInstance.CurrentState.Name}`
      );

      let pollCount = 0;

      const intervalID = setInterval(() => {
        pollCount++;

        EC2.describeInstances({ InstanceIds: [INSTANCE_ID] }, (err, res) => {
          if (pollCount > MAX_POOL_REQUESTS) {
            console.error("Maximum polling limit reached, stopping");
            clearInterval(intervalID);
          }

          if (err) {
            console.warn("Error while querying instance status", err);
          }

          if (res.Reservations.length > 1) {
            console.error("There is more than one Reservations!");
            console.log(inspect(res, true, 9e9, true));
          }

          if (res.Reservations[0].Instances.length > 1) {
            console.error("There is more than one Instances!");
            console.log(inspect(res, true, 9e9, true));
          }

          const mainInstance = res.Reservations[0].Instances[0];

          if (!(pollCount % 5)) {
            console.log(
              `Instance ${mainInstance.InstanceId} status: ${mainInstance.State.Name}`
            );
          }

          if (mainInstance.State.Code === INSTANCE_STATUS_CODES.STOPPED) {
            clearInterval(intervalID);

            console.log(
              `Instance ${mainInstance.InstanceId} stopped successfully`
            );
          }
        });
      }, POLL_INTERVAL);
    }
  );
});
