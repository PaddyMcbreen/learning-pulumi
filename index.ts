import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const config = new pulumi.Config()

interface vpc {
    vpc_name: string;
    vpc_cidr: string;
    azs: string[];
    pub_sub_cidrs: string[];
    priv_sub_cidrs: string[];
}


interface yourDetails {
    yourIP: string;
    yourAccessKey: string;
}


// define objects from config file
const vpc = config.requireObject<vpc>("vpc")
const yourDetails = config.requireObject<yourDetails>("yourDetails")


// ----NETWORKING----
// create VPC
const main = new aws.ec2.Vpc("main-vpc", {
    cidrBlock: vpc.vpc_cidr,
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: {
        Name: `${pulumi.getProject()}-${vpc.vpc_name}`,
        ManagedBy: "Pulumi"
    }
})


// create pub subs
const pub_subs = vpc.pub_sub_cidrs.map((subnet, index) => {
    return new aws.ec2.Subnet(`pub_sub${index + 1}`, {
        cidrBlock: vpc.pub_sub_cidrs[index],
        vpcId: main.id,
        availabilityZone: vpc.azs[index],
        mapPublicIpOnLaunch:true,
        tags: {
            Name: `${pulumi.getProject()}-pub-sub${index + 1}`,
            ManagedBy: "Pulumi"
        }
    })
})


// create priv subs
const priv_subs = vpc.priv_sub_cidrs.map((subnet, index) => {
    return new aws.ec2.Subnet(`priv_sub${index + 1}`, {
        cidrBlock: vpc.priv_sub_cidrs[index],
        vpcId: main.id,
        availabilityZone: vpc.azs[index],
        mapPublicIpOnLaunch: false,
        tags: {
            Name: `${pulumi.getProject()}-priv-sub${index + 1}`,
            ManagedBy: "Pulumi"
        }
    })
})


// create ig
const ig = new aws.ec2.InternetGateway("main-ig", {
    vpcId: main.id,
    tags: {
        Name: `${pulumi.getProject()}-ig`,
        ManagedBy: "Pulumi"
    }
})


// create public rt
const pub_rt = new aws.ec2.RouteTable("pub_rt", {
    vpcId: main.id,
    routes: [
        {
            cidrBlock: "0.0.0.0/0",
            gatewayId: ig.id,
        }],
    tags: {
        Name: `${pulumi.getProject()}-pub-rt`,
        ManagedBy: "Pulumi"
    }
});


// public rt associations
const rt_associate_pub = pub_subs.map((subnet, index) => {
    return new aws.ec2.RouteTableAssociation(`rt_associate_pub-${index + 1}`, {
        subnetId: subnet.id,
        routeTableId: pub_rt.id
    })
})


// create elastic IP
let natGwEip = new aws.ec2.Eip ("natgw-eip", {
    vpc: true
})


// create natgateway
const ngw = new aws.ec2.NatGateway("main-ngw", {
    allocationId: natGwEip.id,
    subnetId: priv_subs[0].id,

    tags: {
        Name: `${pulumi.getProject()}-ngw`,
        ManagedBy: "Pulumi"
    }
})


// create priv rt
const priv_rt = new aws.ec2.RouteTable("priv_rt", {
    vpcId: main.id,
    routes: [
        {
            cidrBlock: "0.0.0.0/0",
            natGatewayId: ngw.id,
        }],
    tags: {
        Name: `${pulumi.getProject()}-priv-rt`,
        ManagedBy: "Pulumi"
    }
});


// rt associations
const rt_associate_priv = priv_subs.map((subnet, index) => {
    return new aws.ec2.RouteTableAssociation(`rt_associate_priv-${index + 1}`, {
        subnetId: subnet.id,
        routeTableId: priv_rt.id
    })
})



// ----SECURITY----

// create security group - SSH IN
const sg_ssh = new aws.ec2.SecurityGroup("allow-ssh", {
    description: "Allows SSH connections from the provided IP address",
    vpcId: main.id,

    tags: {
        Name: `${pulumi.getProject()}-sg-allow-ssh`,
        ManagedBy: "Pulumi"
    }
  });

//   const sg_ssh_ingress = new aws.vpc.SecurityGroupIngressRule("ssh-ingress", {
//     securityGroupId: sg_ssh.id,
//     cidrIpv4: yourDetails.yourIP,
//     fromPort: 22,
//     ipProtocol: "tcp",
//     toPort: 22,
//   });

// create security group - HTTP
const sg_http = new aws.ec2.SecurityGroup("allow-http", {
    description: "Allow HTTP connections",
    vpcId: main.id,

    tags: {
        Name: `${pulumi.getProject()}-sg-allow-http`,
        ManagedBy: "Pulumi"
    }
  });

const sg_http_ingress80 = new aws.vpc.SecurityGroupIngressRule(
    "http-80-ingress",
    {
      securityGroupId: sg_http.id,
      cidrIpv4: "0.0.0.0/0",
      fromPort: 80,
      ipProtocol: "tcp",
      toPort: 80,
    }
  );

const sg_http_ingress3000 = new aws.vpc.SecurityGroupIngressRule(
    "http-3000-ingress",
    {
      securityGroupId: sg_http.id,
      cidrIpv4: "0.0.0.0/0",
      // need to figure out which port the app is listening on
      fromPort: 3000,
      ipProtocol: "tcp",
      toPort: 3000,
    }
  );


  const sg_egress = new aws.ec2.SecurityGroup("allow-egress", {
    description: "Allow Egress connections",
    vpcId: main.id,

    tags: {
        Name: `${pulumi.getProject()}-sg-allow-egress`,
        ManagedBy: "Pulumi"
    }
  });

const sg_egress_rule = new aws.vpc.SecurityGroupEgressRule("egress", {
    securityGroupId: sg_egress.id,
    cidrIpv4: "0.0.0.0/0",
    ipProtocol: "-1",
  });




// exports:
export const vpc_export = main 