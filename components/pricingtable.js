import { useState } from 'react';
import { Container, Row, Col, Card, CardBody, Badge, Button } from 'reactstrap';
import { FaCheck } from 'react-icons/fa';
import getBaseURL from '../hooks/getbaseurl';

const tiers = [
  {
    key: 'free',
    name: 'Free',
    accent: '#6c757d',
    price: { monthly: '$0', annual: '$0' },
    features: [
      '5 channels, 250 MB storage',
      'Maps, 360 media, and slideshows',
      'Default markers and tilesets',
    ],
  },
  {
    key: 'starter',
    name: 'Starter',
    accent: '#0d6efd',
    price: { monthly: '$5', annual: '$4' },
    features: [
      '25 channels, 5 GB storage',
      'Custom markers and overlays',
      'Invite other editors',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    accent: '#198754',
    price: { monthly: '$20', annual: '$16' },
    features: [
      'Unlimited channels, 50 GB storage',
      'Everything in Starter',
      'Video generation',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    accent: '#6f42c1',
    price: { monthly: 'Custom', annual: 'Custom' },
    features: [
      'Custom limits',
      'Everything in Pro',
      'API access, SSO, custom domains, priority support, local hosting, etc.',
    ],
  },
];

const tierOrder = ['free', 'starter', 'pro', 'enterprise'];

export default function PricingTable({ currentPlan, onSelectPlan, onManageBilling }) {
  const [annual, setAnnual] = useState(false);
  const currentIndex = tierOrder.indexOf(currentPlan || 'free');

  return (
    <Container id="pricing" className="py-4">
      <Row>
        {tiers.map(({ key, name, accent, price, features }) => {
          const tierPrice = annual ? price.annual : price.monthly;
          const isCurrent = currentPlan === key;

          return (
            <Col key={key} xs="12" sm="6" lg="3" className="mb-4">
              <Card className="h-100 shadow-sm" style={{
                borderRadius: '10px',
                border: '1px solid #e9ecef',
              }}>
                <CardBody className="d-flex flex-column" style={{ padding: '24px 20px' }}>
                  <div className="d-flex align-items-center mb-2">
                    <h5 style={{ color: accent, fontWeight: 'bold', marginBottom: 0 }}>{name}</h5>
                    {isCurrent && <Badge style={{ marginLeft: '8px', fontSize: '0.65rem', backgroundColor: accent }}>Current</Badge>}
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#333' }}>{tierPrice}</span>
                    {key !== 'free' && key !== 'enterprise' && <span style={{ fontSize: '0.85rem', color: '#999' }}>/mo</span>}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, flexGrow: 1 }}>
                    {features.map((feature, i) => (
                      <li key={i} style={{ fontSize: '0.85rem', color: '#555', marginBottom: '6px', display: 'flex', alignItems: 'flex-start' }}>
                        <FaCheck size={12} style={{ color: accent, marginRight: '8px', marginTop: '3px', flexShrink: 0 }} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    {key === 'free' && !isCurrent && !currentPlan && (
                      <Button href={getBaseURL() + "/api/connect/google"} block outline style={{ borderColor: accent, color: accent, borderRadius: '8px' }}>
                        Get Started
                      </Button>
                    )}
                    {key === 'free' && !isCurrent && currentPlan && (
                      <Button
                        block
                        style={{ borderColor: accent, color: accent, borderRadius: '8px', backgroundColor: 'transparent' }}
                        onClick={() => onSelectPlan?.(key, annual ? 'annual' : 'monthly')}
                      >
                        Downgrade
                      </Button>
                    )}
                    {(key === 'starter' || key === 'pro') && !isCurrent && !currentPlan && (
                      <Button
                        block
                        href={getBaseURL() + "/api/connect/google"}
                        style={{ backgroundColor: accent, borderColor: accent, color: 'white', borderRadius: '8px' }}
                      >
                        Get Started
                      </Button>
                    )}
                    {(key === 'starter' || key === 'pro') && !isCurrent && currentPlan && (
                      <Button
                        block
                        style={tierOrder.indexOf(key) > currentIndex
                          ? { backgroundColor: accent, borderColor: accent, color: 'white', borderRadius: '8px' }
                          : { borderColor: accent, color: accent, borderRadius: '8px', backgroundColor: 'transparent' }}
                        onClick={() => onSelectPlan?.(key, annual ? 'annual' : 'monthly')}
                      >
                        {tierOrder.indexOf(key) > currentIndex ? 'Upgrade' : 'Downgrade'}
                      </Button>
                    )}
                    {key === 'enterprise' && !isCurrent && (
                      <Button href="mailto:fotomap@represent.org" block outline style={{ borderColor: accent, color: accent, borderRadius: '8px' }}>
                        Contact Us
                      </Button>
                    )}
                    {isCurrent && (
                      <Button
                        block
                        disabled={key === 'free' || !onManageBilling}
                        onClick={onManageBilling}
                        style={{ borderRadius: '8px' }}
                      >
                        {key === 'free' ? 'Current Plan' : 'Manage'}
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            </Col>
          );
        })}
      </Row>
      <div className="text-center mt-2">
        <span
          style={{ cursor: 'pointer', fontWeight: !annual ? 'bold' : 'normal', color: !annual ? 'rgba(26, 95, 122, 0.9)' : '#999', fontSize: '0.9rem' }}
          onClick={() => setAnnual(false)}
        >
          Monthly
        </span>
        <span style={{ margin: '0 8px', color: '#ccc' }}>|</span>
        <span
          style={{ cursor: 'pointer', fontWeight: annual ? 'bold' : 'normal', color: annual ? 'rgba(26, 95, 122, 0.9)' : '#999', fontSize: '0.9rem' }}
          onClick={() => setAnnual(true)}
        >
          Annual <span style={{ fontSize: '0.75rem', color: '#198754' }}>Save 20%</span>
        </span>
      </div>
    </Container>
  );
}
